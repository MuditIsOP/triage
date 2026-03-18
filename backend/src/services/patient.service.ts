import {
  AuditEventType,
  DataSource,
  InjurySeverity,
  LlmStatus,
  PatientGuidancePromptKey,
  PatientStatus,
  Priority,
  RiskFlag,
  Role,
  SymptomInputMode,
  type DoctorOverride,
  type InjuryIncident,
  type PatientHistory,
  type PatientSymptoms,
  type PatientVitals,
} from "@er-triage/shared";
import type { HydratedDocument } from "mongoose";
import { PatientModel, type PatientDocument } from "../models/patient.model";
import { createAuditLog, listAuditLogs } from "./audit.service";
import { formatPatientId, getNextPatientSequence } from "./id.service";
import {
  createLLMAnalysis,
  createPatientGuidance,
  type LLMAnalysisResult,
  type PatientGuidanceResult,
} from "./llm.service";
import { getOrCreateSystemConfig } from "./system.service";
import { getHardCriticalFactor, runTriage } from "./triage.service";
import { ApiError } from "../utils/api-error";

type QueuePatientResponse = {
  patientId: string;
  priority: Priority;
  status: PatientStatus;
  waitingTimeMinutes: number;
  name?: string;
  score?: number;
  riskFlags?: RiskFlag[];
  topFactor?: string;
  contributors?: string[];
  aiSummary?: string;
  llmStatus?: LlmStatus;
  isDemo?: boolean;
  manualReviewRequired?: boolean;
  overrideActive?: boolean;
  bedLabel?: string | null;
  dataSourceLabel?: "manual" | "simulation";
  bedReallocation?: {
    state: "none" | "reassigned" | "transferring";
    message: string;
    displacedByPatientId: string | null;
    updatedAt: Date | null;
  };
};

export type PatientGuidanceResponse = PatientGuidanceResult & {
  promptKey: PatientGuidancePromptKey;
};

export type IntakePreviewInput = {
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  symptoms: {
    controlled: string[];
    otherText: string;
  };
  vitals: Partial<Record<keyof PatientVitals, number | null>>;
  injuryIncident?: Partial<InjuryIncident>;
  history?: Partial<PatientHistory>;
};

export type CreatePatientInput = IntakePreviewInput & {
  confirmedNormalizedSymptoms?: string[];
  duplicateConfirmed?: boolean;
  waitingTimeMinutes?: number;
};

export type QuickEntryInput = {
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  controlledSymptoms?: string[];
  otherText?: string;
  vitals: Partial<Record<keyof PatientVitals, number | null>>;
  duplicateConfirmed?: boolean;
};

export type UpdatePatientInput = {
  version: number;
  symptoms?: {
    controlled?: string[];
    otherText?: string;
    confirmedNormalizedSymptoms?: string[];
  };
  vitals?: Partial<Record<keyof PatientVitals, { value: number | null; dataSource?: DataSource }>>;
  injuryIncident?: Partial<InjuryIncident>;
  history?: Partial<PatientHistory>;
  doctorNotes?: string;
};

export type StatusUpdateInput = {
  version: number;
  status: PatientStatus;
  referral?: {
    destination: string;
    reason: string;
  };
  clearManualReview?: boolean;
};

export type OverrideInput = {
  version: number;
  priority: Priority;
  scope: string;
};

type DemoScenario = {
  controlledSymptoms: string[];
  otherText: string;
  vitals: {
    oxygenSaturation: number;
    bloodPressureSystolic: number;
    bloodPressureDiastolic: number;
    heartRate: number;
    temperature: number;
    bloodSugar: number;
  };
  injury: {
    type: string;
    severity: InjurySeverity | null;
    bleeding: boolean;
    unconsciousReported: boolean;
  };
  history: {
    diabetes: boolean;
    hypertension: boolean;
    heartDisease: boolean;
    other: string;
  };
  waitingTimeMinutes: number;
};

const ACTIVE_PATIENT_STATUSES = [PatientStatus.Waiting, PatientStatus.InTreatment, PatientStatus.Completed];
const ACTIVE_QUEUE_STATUSES = [PatientStatus.Waiting, PatientStatus.InTreatment, PatientStatus.Completed];

const maleNames = [
  "Aarav Singh",
  "Kabir Mehra",
  "Vihaan Sharma",
  "Ishaan Verma",
  "Aditya Nair",
  "Rohan Kulkarni",
  "Arjun Iyer",
  "Dev Malhotra",
];

const femaleNames = [
  "Naina Kapoor",
  "Anaya Reddy",
  "Siya Menon",
  "Kavya Joshi",
  "Meera Bansal",
  "Diya Shetty",
  "Aisha Thomas",
  "Priya Narang",
];

const demoScenarios: DemoScenario[] = [
  {
    controlledSymptoms: ["chest pain", "sweating"],
    otherText: "Severe chest tightness since morning with sweating and mild dizziness.",
    vitals: {
      oxygenSaturation: 95,
      bloodPressureSystolic: 92,
      bloodPressureDiastolic: 62,
      heartRate: 128,
      temperature: 98.4,
      bloodSugar: 178,
    },
    injury: {
      type: "",
      severity: null,
      bleeding: false,
      unconsciousReported: false,
    },
    history: {
      diabetes: false,
      hypertension: true,
      heartDisease: true,
      other: "",
    },
    waitingTimeMinutes: 24,
  },
  {
    controlledSymptoms: ["head injury", "dizziness"],
    otherText: "Patient fell from bike and hit head, bleeding slightly with dizziness.",
    vitals: {
      oxygenSaturation: 97,
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 78,
      heartRate: 102,
      temperature: 99.1,
      bloodSugar: 108,
    },
    injury: {
      type: "Head Injury",
      severity: InjurySeverity.Moderate,
      bleeding: true,
      unconsciousReported: false,
    },
    history: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      other: "",
    },
    waitingTimeMinutes: 32,
  },
  {
    controlledSymptoms: ["fever", "cough"],
    otherText: "High fever for 3 days with cough, weakness, and poor appetite.",
    vitals: {
      oxygenSaturation: 93,
      bloodPressureSystolic: 110,
      bloodPressureDiastolic: 74,
      heartRate: 112,
      temperature: 102.2,
      bloodSugar: 144,
    },
    injury: {
      type: "",
      severity: null,
      bleeding: false,
      unconsciousReported: false,
    },
    history: {
      diabetes: true,
      hypertension: false,
      heartDisease: false,
      other: "",
    },
    waitingTimeMinutes: 46,
  },
  {
    controlledSymptoms: ["abdominal pain"],
    otherText: "Sharp abdominal pain since last night with nausea and weakness.",
    vitals: {
      oxygenSaturation: 98,
      bloodPressureSystolic: 124,
      bloodPressureDiastolic: 82,
      heartRate: 96,
      temperature: 99,
      bloodSugar: 132,
    },
    injury: {
      type: "",
      severity: null,
      bleeding: false,
      unconsciousReported: false,
    },
    history: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      other: "",
    },
    waitingTimeMinutes: 18,
  },
  {
    controlledSymptoms: ["breathing difficulty"],
    otherText: "Rapid breathing and chest heaviness started suddenly this afternoon.",
    vitals: {
      oxygenSaturation: 82,
      bloodPressureSystolic: 78,
      bloodPressureDiastolic: 50,
      heartRate: 142,
      temperature: 100.1,
      bloodSugar: 166,
    },
    injury: {
      type: "",
      severity: null,
      bleeding: false,
      unconsciousReported: false,
    },
    history: {
      diabetes: false,
      hypertension: true,
      heartDisease: true,
      other: "",
    },
    waitingTimeMinutes: 9,
  },
  {
    controlledSymptoms: ["bleeding", "dizziness"],
    otherText: "Road accident with deep leg wound and persistent bleeding.",
    vitals: {
      oxygenSaturation: 88,
      bloodPressureSystolic: 68,
      bloodPressureDiastolic: 42,
      heartRate: 146,
      temperature: 97.8,
      bloodSugar: 118,
    },
    injury: {
      type: "Accident",
      severity: InjurySeverity.Severe,
      bleeding: true,
      unconsciousReported: false,
    },
    history: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      other: "",
    },
    waitingTimeMinutes: 6,
  },
  {
    controlledSymptoms: ["weakness", "sweating"],
    otherText: "General weakness with sweating and low sugar reading at home.",
    vitals: {
      oxygenSaturation: 99,
      bloodPressureSystolic: 104,
      bloodPressureDiastolic: 68,
      heartRate: 88,
      temperature: 97.1,
      bloodSugar: 62,
    },
    injury: {
      type: "",
      severity: null,
      bleeding: false,
      unconsciousReported: false,
    },
    history: {
      diabetes: true,
      hypertension: false,
      heartDisease: false,
      other: "",
    },
    waitingTimeMinutes: 28,
  },
  {
    controlledSymptoms: ["fever", "breathing difficulty"],
    otherText: "Fever with cough and shortness of breath worsening since yesterday.",
    vitals: {
      oxygenSaturation: 90,
      bloodPressureSystolic: 102,
      bloodPressureDiastolic: 66,
      heartRate: 118,
      temperature: 103.1,
      bloodSugar: 206,
    },
    injury: {
      type: "",
      severity: null,
      bleeding: false,
      unconsciousReported: false,
    },
    history: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      other: "",
    },
    waitingTimeMinutes: 37,
  },
];

const priorityRank: Record<Priority, number> = {
  [Priority.Critical]: 3,
  [Priority.Urgent]: 2,
  [Priority.Normal]: 1,
};

type BedType = "general" | "critical";

type BedDisplacementCandidate = {
  patient: HydratedDocument<PatientDocument>;
  bedType: BedType;
  bedId: string;
};

const riskFlagDerivations: Array<{
  condition: (patient: HydratedDocument<PatientDocument>) => boolean;
  flag: RiskFlag;
}> = [
  {
    condition: (patient) => (getPatientVitals(patient).oxygenSaturation?.value ?? 100) < 90,
    flag: RiskFlag.BreathingIssue,
  },
  {
    condition: (patient) => (getPatientVitals(patient).bloodPressureSystolic?.value ?? 120) < 90,
    flag: RiskFlag.CirculationIssue,
  },
  {
    condition: (patient) => Boolean(getPatientInjury(patient).bleeding),
    flag: RiskFlag.ExternalBleeding,
  },
  {
    condition: (patient) =>
      Boolean(getPatientInjury(patient).type) &&
      ["accident", "fall", "head injury"].some((term) =>
        String(getPatientInjury(patient).type).toLowerCase().includes(term),
      ),
    flag: RiskFlag.Trauma,
  },
  {
    condition: (patient) => Boolean(getPatientInjury(patient).unconsciousReported),
    flag: RiskFlag.NeurologicalRisk,
  },
  {
    condition: (patient) => {
      const symptoms = getPatientSymptoms(patient);
      const combinedSymptoms = [
        ...(symptoms.controlled ?? []),
        ...(symptoms.normalizedSymptoms ?? []),
        symptoms.otherText ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return combinedSymptoms.includes("chest");
    },
    flag: RiskFlag.CardiacRisk,
  },
  {
    condition: (patient) => (getPatientVitals(patient).temperature?.value ?? 98.6) >= 101.5,
    flag: RiskFlag.InfectionRisk,
  },
  {
    condition: (patient) => {
      const vitals = getPatientVitals(patient);
      const oxygen = vitals.oxygenSaturation?.value ?? 100;
      const heartRate = vitals.heartRate?.value ?? 80;
      const systolic = vitals.bloodPressureSystolic?.value ?? 120;
      return oxygen < 90 && heartRate > 120 && systolic < 90;
    },
    flag: RiskFlag.ShockRisk,
  },
];

const getRandomItem = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const randomAge = () => Math.floor(Math.random() * 90) + 1;
const roundToSingleDecimal = (value: number) => Number(value.toFixed(1));
const getPatientSimulationSeed = (patientId: string) =>
  patientId.split("").reduce((total, character, index) => total + character.charCodeAt(0) * (index + 1), 0);
const getSeededOffset = (seed: number, span: number) => (((seed % 1000) / 999) * 2 - 1) * span;
const driftWithinBand = (
  value: number | null,
  {
    min,
    max,
    center,
    volatility,
    recenterStrength = 0.22,
  }: {
    min: number;
    max: number;
    center: number;
    volatility: number;
    recenterStrength?: number;
  },
) => {
  if (value === null) {
    return value;
  }

  const nextValue = value + (center - value) * recenterStrength + (Math.random() - 0.5) * volatility;
  return clamp(roundToSingleDecimal(nextValue), min, max);
};

const sortQueue = (patients: QueuePatientResponse[]) =>
  [...patients].sort((left, right) => {
    const priorityDelta = priorityRank[right.priority] - priorityRank[left.priority];

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const rightScore = right.score ?? 0;
    const leftScore = left.score ?? 0;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return right.waitingTimeMinutes - left.waitingTimeMinutes;
  });

const buildName = () => {
  const gender = Math.random() > 0.5 ? "male" : "female";
  const name = gender === "male" ? getRandomItem(maleNames) : getRandomItem(femaleNames);
  return { gender: gender as "male" | "female", name };
};

const buildVitals = (
  vitals: Partial<Record<keyof PatientVitals, number | null>>,
  defaultSource: DataSource,
): PatientVitals => ({
  heartRate: { value: vitals.heartRate ?? null, dataSource: defaultSource },
  bloodPressureSystolic: { value: vitals.bloodPressureSystolic ?? null, dataSource: defaultSource },
  bloodPressureDiastolic: { value: vitals.bloodPressureDiastolic ?? null, dataSource: defaultSource },
  temperature: { value: vitals.temperature ?? null, dataSource: defaultSource },
  oxygenSaturation: { value: vitals.oxygenSaturation ?? null, dataSource: defaultSource },
  bloodSugar: { value: vitals.bloodSugar ?? null, dataSource: defaultSource },
});

const emptyHistory = (): PatientHistory => ({
  diabetes: false,
  hypertension: false,
  heartDisease: false,
  other: "",
});

const emptyInjury = (): InjuryIncident => ({
  type: "",
  severity: null,
  bleeding: false,
  unconsciousReported: false,
});

const asRef = (value: string | null) => value as unknown as never;

const getPatientVitals = (patient: HydratedDocument<PatientDocument>): PatientVitals =>
  (patient.vitals ?? buildVitals({}, DataSource.Manual)) as PatientVitals;

const getPatientSymptoms = (
  patient: HydratedDocument<PatientDocument>,
): PatientDocument["symptoms"] & {
  controlled: string[];
  otherText: string;
  normalizedSymptoms: string[];
  llmOriginalNormalizedSymptoms: string[];
  nurseConfirmedSymptoms: boolean;
} =>
  ((patient.symptoms ?? {
    controlled: [],
    otherText: "",
    inputMode: SymptomInputMode.Controlled,
    normalizedSymptoms: [],
    llmOriginalNormalizedSymptoms: [],
    nurseConfirmedSymptoms: false,
  }) as never);

const getPatientHistory = (patient: HydratedDocument<PatientDocument>): PatientHistory =>
  ((patient.history ?? emptyHistory()) as never);

const getPatientInjury = (patient: HydratedDocument<PatientDocument>): InjuryIncident =>
  ((patient.injuryIncident ?? emptyInjury()) as never);

const getPatientAi = (
  patient: HydratedDocument<PatientDocument>,
): {
  riskFlags: RiskFlag[];
  criticalRiskConfidence: number;
  summary: string;
  llmStatus: LlmStatus;
} => ({
  riskFlags: ((patient.ai?.riskFlags ?? []) as RiskFlag[]),
  criticalRiskConfidence: patient.ai?.criticalRiskConfidence ?? 0,
  summary: patient.ai?.summary ?? "AI summary unavailable",
  llmStatus: (patient.ai?.llmStatus ?? LlmStatus.Fallback) as LlmStatus,
});

const getWaitingTimeMinutes = (patient: HydratedDocument<PatientDocument>) => {
  const elapsedMinutes = patient.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(patient.createdAt).getTime()) / 60000))
    : 0;

  if (patient.status === PatientStatus.Waiting) {
    return Math.max(patient.waitingTimeMinutes ?? 0, elapsedMinutes);
  }

  return patient.waitingTimeMinutes ?? elapsedMinutes;
};

const serializeVitalsForHistory = (patient: HydratedDocument<PatientDocument>) => ({
  heartRate: getPatientVitals(patient).heartRate?.value ?? null,
  bloodPressureSystolic: getPatientVitals(patient).bloodPressureSystolic?.value ?? null,
  bloodPressureDiastolic: getPatientVitals(patient).bloodPressureDiastolic?.value ?? null,
  temperature: getPatientVitals(patient).temperature?.value ?? null,
  oxygenSaturation: getPatientVitals(patient).oxygenSaturation?.value ?? null,
  bloodSugar: getPatientVitals(patient).bloodSugar?.value ?? null,
});

const addVitalsHistorySnapshot = (
  patient: HydratedDocument<PatientDocument>,
  source: "manual" | "simulation" | "system",
) => {
  patient.vitalsHistory.push({
    recordedAt: new Date(),
    source,
    score: patient.score,
    priority: patient.priority,
    ...serializeVitalsForHistory(patient),
  });

  if (patient.vitalsHistory.length > 60) {
    patient.vitalsHistory.splice(0, patient.vitalsHistory.length - 60);
  }
};

const getOverallDataSourceLabel = (patient: HydratedDocument<PatientDocument>) => {
  const vitals = Object.values(getPatientVitals(patient) ?? {});
  return vitals.some((entry) => entry?.dataSource === DataSource.Simulation) ? "simulation" : "manual";
};

const getDerivedRiskFlags = (patient: HydratedDocument<PatientDocument>) =>
  riskFlagDerivations.filter((entry) => entry.condition(patient)).map((entry) => entry.flag);

const getFinalRiskFlags = (patient: HydratedDocument<PatientDocument>) =>
  Array.from(new Set([...(patient.ai?.riskFlags ?? []), ...getDerivedRiskFlags(patient)]));

const buildTriageInputFromPatient = (patient: HydratedDocument<PatientDocument>) => ({
  vitals: getPatientVitals(patient),
  symptoms: {
    ...(getPatientSymptoms(patient) as PatientSymptoms & {
      normalizedSymptoms?: string[];
    }),
    normalizedSymptoms: getPatientSymptoms(patient).normalizedSymptoms ?? [],
  },
  injury: getPatientInjury(patient),
  history: getPatientHistory(patient),
  ai: {
    riskFlags: getFinalRiskFlags(patient),
    criticalRiskConfidence: getPatientAi(patient).criticalRiskConfidence,
    llmStatus: getPatientAi(patient).llmStatus,
  },
  doctorOverride: patient.doctorOverride as DoctorOverride | null,
  waitingTimeMinutes: getWaitingTimeMinutes(patient),
  currentPriority: patient.priority,
});

const getQueueBedLabel = (patient: HydratedDocument<PatientDocument>) =>
  patient.bedAssignment?.bedId
    ? `${patient.bedAssignment.bedType === "critical" ? "Critical" : "General"} ${patient.bedAssignment.bedId}`
    : null;

const buildPatientGuidanceContext = (patient: HydratedDocument<PatientDocument>) => ({
  patientId: patient.patientId,
  demographics: {
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
  },
  triage: {
    priority: patient.priority,
    score: patient.score,
    status: patient.status,
    waitingTimeMinutes: getWaitingTimeMinutes(patient),
    topFactor: patient.explanation?.topFactor ?? "",
    contributors: patient.explanation?.contributors ?? [],
    manualReviewRequired: patient.manualReviewRequired,
  },
  symptoms: {
    controlled: getPatientSymptoms(patient).controlled,
    otherText: getPatientSymptoms(patient).otherText,
    normalizedSymptoms: getPatientSymptoms(patient).normalizedSymptoms ?? [],
    llmOriginalNormalizedSymptoms: getPatientSymptoms(patient).llmOriginalNormalizedSymptoms ?? [],
    nurseConfirmedSymptoms: getPatientSymptoms(patient).nurseConfirmedSymptoms ?? false,
  },
  vitals: serializeVitalsForHistory(patient),
  injuryIncident: getPatientInjury(patient),
  history: getPatientHistory(patient),
  ai: {
    riskFlags: getFinalRiskFlags(patient),
    criticalRiskConfidence: getPatientAi(patient).criticalRiskConfidence,
    summary: getPatientAi(patient).summary,
    llmStatus: getPatientAi(patient).llmStatus,
  },
  override: {
    isActive: patient.doctorOverride?.isActive ?? false,
    priority: patient.doctorOverride?.priority ?? null,
    scope: patient.doctorOverride?.scope ?? "",
  },
  bedAssignment: {
    label: getQueueBedLabel(patient),
    priorityMismatch: patient.bedAssignment?.priorityMismatch ?? false,
    reallocation: patient.bedReallocation ?? null,
  },
  notes: {
    doctorNotes: patient.doctorNotes ?? "",
    referral: patient.referral ?? { destination: "", reason: "" },
  },
});

const clearBedReallocationState = (patient: HydratedDocument<PatientDocument>) => {
  patient.bedReallocation = {
    state: "none",
    message: "",
    displacedByPatientId: null,
    updatedAt: null,
  } as never;
};

const setBedAssignmentState = (
  patient: HydratedDocument<PatientDocument>,
  bedId: string | null,
  bedType: BedType | null,
  priorityMismatch: boolean,
) => {
  patient.bedAssignment = {
    bedId,
    bedType,
    priorityMismatch,
  };

  if (bedId) {
    clearBedReallocationState(patient);
  }
};

const markPatientReallocated = (
  patient: HydratedDocument<PatientDocument>,
  incomingPatientId: string,
  bedId: string,
) => {
  patient.bedReallocation = {
    state: patient.status === PatientStatus.InTreatment ? "transferring" : "reassigned",
    message:
      patient.status === PatientStatus.InTreatment
        ? `Transferred from bed ${bedId} to prioritize critical patient ${incomingPatientId}.`
        : `Bed ${bedId} reassigned to critical patient ${incomingPatientId}.`,
    displacedByPatientId: incomingPatientId,
    updatedAt: new Date(),
  } as never;
};

const mapPatientToQueueResponse = (
  patient: HydratedDocument<PatientDocument>,
  role: Role,
): QueuePatientResponse => {
  const waitingTimeMinutes = getWaitingTimeMinutes(patient);

  if (role === Role.Viewer) {
    return {
      patientId: patient.patientId,
      priority: patient.priority,
      status: patient.status,
      waitingTimeMinutes,
    };
  }

  return {
    patientId: patient.patientId,
    name: patient.name,
    priority: patient.priority,
    score: patient.score,
    status: patient.status,
    waitingTimeMinutes,
    riskFlags: getFinalRiskFlags(patient),
    topFactor: patient.explanation?.topFactor ?? "Pending review",
    contributors: patient.explanation?.contributors ?? [],
    aiSummary: getPatientAi(patient).summary,
    llmStatus: getPatientAi(patient).llmStatus,
    isDemo: patient.isDemo,
    manualReviewRequired: patient.manualReviewRequired,
    overrideActive: patient.doctorOverride?.isActive ?? false,
    bedLabel: getQueueBedLabel(patient),
    dataSourceLabel: getOverallDataSourceLabel(patient),
    bedReallocation: patient.bedReallocation
      ? {
          state: patient.bedReallocation.state ?? "none",
          message: patient.bedReallocation.message ?? "",
          displacedByPatientId: patient.bedReallocation.displacedByPatientId ?? null,
          updatedAt: patient.bedReallocation.updatedAt ?? null,
        }
      : undefined,
  };
};

const isDuplicatePatient = async ({
  name,
  age,
  gender,
  excludePatientId,
}: {
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  excludePatientId?: string;
}) => {
  const existingPatient = await PatientModel.findOne({
    name: name.trim(),
    age,
    gender,
    status: { $in: ACTIVE_PATIENT_STATUSES },
    ...(excludePatientId ? { patientId: { $ne: excludePatientId } } : {}),
  });

  return existingPatient;
};

const runAnalysis = async (input: IntakePreviewInput): Promise<LLMAnalysisResult> => {
  if (!input.symptoms.otherText.trim()) {
    return {
      status: LlmStatus.Fallback,
      risk_flags: [],
      critical_risk_confidence: 0,
      summary: "AI analysis unavailable. Score based on rule engine only.",
      normalized_symptoms: [],
    };
  }

  return createLLMAnalysis({
    symptoms: [input.symptoms.controlled.join(", "), input.symptoms.otherText].filter(Boolean).join(". "),
    vitals: input.vitals,
    injury: input.injuryIncident ?? emptyInjury(),
    history: input.history ?? emptyHistory(),
  });
};

const buildBedIdentifiers = (prefix: "G" | "C", total: number) =>
  Array.from({ length: total }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`);

const findBedDisplacementCandidate = (
  patient: HydratedDocument<PatientDocument>,
  activePatients: HydratedDocument<PatientDocument>[],
): BedDisplacementCandidate | null => {
  const targetRank = priorityRank[patient.priority];
  const candidates = activePatients
    .filter((entry) => entry.bedAssignment?.bedId && entry.bedAssignment?.bedType)
    .filter((entry) => priorityRank[entry.priority] < targetRank)
    .filter((entry) => (patient.priority === Priority.Urgent ? entry.bedAssignment?.bedType === "general" : true))
    .map((entry) => ({
      patient: entry,
      bedType: entry.bedAssignment!.bedType as BedType,
      bedId: entry.bedAssignment!.bedId as string,
    }));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const leftTreatmentPenalty = left.patient.status === PatientStatus.InTreatment ? 1 : 0;
    const rightTreatmentPenalty = right.patient.status === PatientStatus.InTreatment ? 1 : 0;
    if (leftTreatmentPenalty !== rightTreatmentPenalty) {
      return leftTreatmentPenalty - rightTreatmentPenalty;
    }

    if (patient.priority === Priority.Critical) {
      const leftBedScore = left.bedType === "critical" ? 0 : 1;
      const rightBedScore = right.bedType === "critical" ? 0 : 1;
      if (leftBedScore !== rightBedScore) {
        return leftBedScore - rightBedScore;
      }
    }

    const leftPriorityScore = priorityRank[left.patient.priority];
    const rightPriorityScore = priorityRank[right.patient.priority];
    if (leftPriorityScore !== rightPriorityScore) {
      return leftPriorityScore - rightPriorityScore;
    }

    return getWaitingTimeMinutes(right.patient) - getWaitingTimeMinutes(left.patient);
  });

  return candidates[0] ?? null;
};

const displacePatientFromBed = async (
  candidate: BedDisplacementCandidate,
  incomingPatient: HydratedDocument<PatientDocument>,
) => {
  const displacedPatient = candidate.patient;
  const oldValue = {
    bedId: candidate.bedId,
    bedType: candidate.bedType,
  };

  setBedAssignmentState(displacedPatient, null, null, false);
  markPatientReallocated(displacedPatient, incomingPatient.patientId, candidate.bedId);
  displacedPatient.lastModifiedAt = new Date();
  displacedPatient.version += 1;
  await displacedPatient.save();

  await createAuditLog({
    eventType: AuditEventType.BedReleased,
    userId: incomingPatient.createdBy.toString(),
    patientId: displacedPatient._id.toString(),
    oldValue,
    newValue: null,
    metadata: {
      reason: "reallocated_for_higher_priority_patient",
      displacedByPatientId: incomingPatient.patientId,
      transferState: displacedPatient.bedReallocation?.state ?? "reassigned",
    },
  });
};

const applyBedAssignment = async (
  patient: HydratedDocument<PatientDocument>,
  otherPatients?: HydratedDocument<PatientDocument>[],
) => {
  if ([PatientStatus.Completed, PatientStatus.Discharged, PatientStatus.Referred].includes(patient.status)) {
    setBedAssignmentState(patient, null, null, false);
    return;
  }

  const config = await getOrCreateSystemConfig();
  const activePatients =
    otherPatients ??
    (await PatientModel.find({
      _id: { $ne: patient._id },
      status: { $in: [PatientStatus.Waiting, PatientStatus.InTreatment] },
      "bedAssignment.bedId": { $ne: null },
    }));

  const occupiedGeneral = new Set(
    activePatients
      .filter((entry) => entry.bedAssignment?.bedType === "general" && entry.bedAssignment.bedId)
      .map((entry) => entry.bedAssignment!.bedId as string),
  );
  const occupiedCritical = new Set(
    activePatients
      .filter((entry) => entry.bedAssignment?.bedType === "critical" && entry.bedAssignment.bedId)
      .map((entry) => entry.bedAssignment!.bedId as string),
  );

  const availableGeneral = buildBedIdentifiers("G", config.generalBedCount).find((id) => !occupiedGeneral.has(id));
  const availableCritical = buildBedIdentifiers("C", config.criticalBedCount).find((id) => !occupiedCritical.has(id));

  if (patient.priority === Priority.Critical) {
    if (availableCritical) {
      setBedAssignmentState(patient, availableCritical, "critical", false);
      return;
    }

    if (availableGeneral) {
      setBedAssignmentState(patient, availableGeneral, "general", true);
      return;
    }

    const displacementCandidate = findBedDisplacementCandidate(patient, activePatients);
    if (displacementCandidate) {
      await displacePatientFromBed(displacementCandidate, patient);
      setBedAssignmentState(
        patient,
        displacementCandidate.bedId,
        displacementCandidate.bedType,
        displacementCandidate.bedType === "general",
      );
      return;
    }

    setBedAssignmentState(patient, null, null, false);
    return;
  }

  if (availableGeneral) {
    setBedAssignmentState(patient, availableGeneral, "general", false);
    return;
  }

  if (patient.priority === Priority.Urgent) {
    const displacementCandidate = findBedDisplacementCandidate(patient, activePatients);
    if (displacementCandidate) {
      await displacePatientFromBed(displacementCandidate, patient);
      setBedAssignmentState(patient, displacementCandidate.bedId, "general", false);
      return;
    }
  }

  if (patient.bedAssignment?.bedId) {
    return;
  }

  setBedAssignmentState(patient, null, null, false);
};

const applyOverrideExpiryRules = async (
  patient: HydratedDocument<PatientDocument>,
  nextStatus: PatientStatus,
  userId: string,
) => {
  if (
    patient.doctorOverride?.isActive &&
    [PatientStatus.Completed, PatientStatus.Discharged, PatientStatus.Referred].includes(nextStatus)
  ) {
    const oldValue = {
      isActive: true,
      priority: patient.doctorOverride.priority,
      scope: patient.doctorOverride.scope,
    };

    patient.doctorOverride = {
      ...patient.doctorOverride,
      isActive: false,
      priority: null,
      scope: "",
      clearedAt: new Date(),
    };
    patient.overrideFlag = false;
    patient.overrideScope = "";

    await createAuditLog({
      eventType: AuditEventType.DoctorOverrideCleared,
      userId,
      patientId: patient._id.toString(),
      oldValue,
      newValue: {
        isActive: false,
      },
      metadata: {
        reason: `status_changed_to_${nextStatus}`,
      },
    });
  }
};

const syncPatientPriorityAndExplanation = async (
  patient: HydratedDocument<PatientDocument>,
  actorId: string,
  source: "manual" | "simulation" | "system",
) => {
  const previousPriority = patient.priority;
  const previousManualReviewRequired = patient.manualReviewRequired;
  const previousBedAssignment = patient.bedAssignment
    ? {
        bedId: patient.bedAssignment.bedId,
        bedType: patient.bedAssignment.bedType,
        priorityMismatch: patient.bedAssignment.priorityMismatch,
      }
    : null;
  patient.waitingTimeMinutes = getWaitingTimeMinutes(patient);

  const triageResult = runTriage(buildTriageInputFromPatient(patient));
  patient.score = triageResult.score;
  patient.priority = triageResult.priority;
  patient.manualReviewRequired = triageResult.manualReviewRequired;
  patient.explanation = {
    topFactor: triageResult.explanation.top_factor,
    contributors: triageResult.explanation.contributors,
  };

  await applyBedAssignment(patient);

  const assignedBedAfterTriage = patient.bedAssignment?.bedId;
  if (patient.status === PatientStatus.Waiting && assignedBedAfterTriage) {
    patient.status = PatientStatus.InTreatment;
  }

  if (previousPriority !== patient.priority) {
    await createAuditLog({
      eventType: AuditEventType.PriorityChanged,
      userId: actorId,
      patientId: patient._id.toString(),
      oldValue: previousPriority,
      newValue: patient.priority,
      metadata: {
        source,
      },
    });
  }

  if (!previousManualReviewRequired && patient.manualReviewRequired) {
    await createAuditLog({
      eventType: AuditEventType.PriorityChanged,
      userId: actorId,
      patientId: patient._id.toString(),
      oldValue: { manualReviewRequired: false },
      newValue: { manualReviewRequired: true },
      metadata: {
        source,
        message: "Awaiting Manual Review",
      },
    });
  }

  if (JSON.stringify(previousBedAssignment) !== JSON.stringify(patient.bedAssignment ?? null)) {
    if (patient.bedAssignment?.bedId) {
      await createAuditLog({
        eventType: AuditEventType.BedAssigned,
        userId: actorId,
        patientId: patient._id.toString(),
        oldValue: previousBedAssignment,
        newValue: patient.bedAssignment,
        metadata: {
          source,
          priorityMismatch: patient.bedAssignment.priorityMismatch,
        },
      });

      if (!previousBedAssignment?.bedId && patient.status === PatientStatus.InTreatment) {
        await createAuditLog({
          eventType: AuditEventType.PatientStatusChanged,
          userId: actorId,
          patientId: patient._id.toString(),
          oldValue: PatientStatus.Waiting,
          newValue: PatientStatus.InTreatment,
          metadata: {
            source,
            reason: "auto_status_on_bed_assignment",
          },
        });
      }
    } else if (previousBedAssignment?.bedId) {
      await createAuditLog({
        eventType: AuditEventType.BedReleased,
        userId: actorId,
        patientId: patient._id.toString(),
        oldValue: previousBedAssignment,
        newValue: null,
        metadata: {
          source,
        },
      });
    }
  }
};

const mapPatientToDetailsResponse = async (patient: HydratedDocument<PatientDocument>) => {
  const auditPreview = await listAuditLogs({ patientId: patient._id.toString(), limit: 6 });

  return {
    id: patient.id,
    patientId: patient.patientId,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    priority: patient.priority,
    score: patient.score,
    status: patient.status,
    waitingTimeMinutes: getWaitingTimeMinutes(patient),
    riskFlags: getFinalRiskFlags(patient),
    llmStatus: getPatientAi(patient).llmStatus,
    aiSummary: getPatientAi(patient).summary,
    aiConfidence: getPatientAi(patient).criticalRiskConfidence,
    normalizedSymptoms: getPatientSymptoms(patient).normalizedSymptoms ?? [],
    llmOriginalNormalizedSymptoms: getPatientSymptoms(patient).llmOriginalNormalizedSymptoms ?? [],
    nurseConfirmedSymptoms: getPatientSymptoms(patient).nurseConfirmedSymptoms,
    symptoms: getPatientSymptoms(patient),
    vitals: getPatientVitals(patient),
    injuryIncident: getPatientInjury(patient),
    history: getPatientHistory(patient),
    topFactor: patient.explanation?.topFactor ?? "Pending review",
    contributors: patient.explanation?.contributors ?? [],
    doctorNotes: patient.doctorNotes,
    bedAssignment: patient.bedAssignment,
    bedReallocation: patient.bedReallocation ?? {
      state: "none",
      message: "",
      displacedByPatientId: null,
      updatedAt: null,
    },
    manualReviewRequired: patient.manualReviewRequired,
    awaitingFullData: patient.awaitingFullData,
    isDemo: patient.isDemo,
    override: patient.doctorOverride,
    referral: patient.referral,
    version: patient.version,
    dataSourceLabel: getOverallDataSourceLabel(patient),
    vitalsHistory: (patient.vitalsHistory ?? []).map((entry) => ({
      recordedAt: entry.recordedAt,
      source: entry.source,
      score: entry.score,
      priority: entry.priority,
      heartRate: entry.heartRate,
      bloodPressureSystolic: entry.bloodPressureSystolic,
      bloodPressureDiastolic: entry.bloodPressureDiastolic,
      temperature: entry.temperature,
      oxygenSaturation: entry.oxygenSaturation,
      bloodSugar: entry.bloodSugar,
    })),
    auditPreview: auditPreview.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType,
      timestamp: entry.timestamp,
      metadata: entry.metadata ?? {},
      oldValue: entry.oldValue,
      newValue: entry.newValue,
    })),
  };
};

const buildPatientDocument = async ({
  sequenceNumber,
  input,
  llmAnalysis,
  createdBy,
  dataSource,
  status,
  awaitingFullData,
  isDemo,
}: {
  sequenceNumber: number;
  input: CreatePatientInput;
  llmAnalysis: LLMAnalysisResult;
  createdBy: string;
  dataSource: DataSource;
  status: PatientStatus;
  awaitingFullData: boolean;
  isDemo: boolean;
}) => {
  const patient = new PatientModel({
    sequenceNumber,
    patientId: formatPatientId(sequenceNumber),
    name: input.name.trim(),
    age: input.age,
    gender: input.gender,
    symptoms: {
      controlled: input.symptoms.controlled,
      otherText: input.symptoms.otherText.trim(),
      inputMode: input.symptoms.otherText.trim() ? SymptomInputMode.Other : SymptomInputMode.Controlled,
      normalizedSymptoms: input.confirmedNormalizedSymptoms ?? llmAnalysis.normalized_symptoms,
      llmOriginalNormalizedSymptoms: llmAnalysis.normalized_symptoms,
      nurseConfirmedSymptoms: input.symptoms.otherText.trim()
        ? Boolean(input.confirmedNormalizedSymptoms)
        : false,
    },
    vitals: buildVitals(input.vitals, dataSource),
    injuryIncident: {
      ...emptyInjury(),
      ...(input.injuryIncident ?? {}),
    },
    history: {
      ...emptyHistory(),
      ...(input.history ?? {}),
    },
    ai: {
      riskFlags: llmAnalysis.risk_flags,
      criticalRiskConfidence: llmAnalysis.critical_risk_confidence,
      summary: llmAnalysis.summary,
      llmStatus: llmAnalysis.status,
    },
    score: 0,
    priority: Priority.Normal,
    status,
    bedAssignment: {
      bedId: null,
      bedType: null,
      priorityMismatch: false,
    },
    bedReallocation: {
      state: "none",
      message: "",
      displacedByPatientId: null,
      updatedAt: null,
    },
    doctorNotes: "",
    overrideFlag: false,
    overrideScope: "",
    doctorOverride: {
      isActive: false,
      priority: null,
      scope: "",
      appliedBy: null,
      appliedAt: null,
      clearedAt: null,
    },
    createdBy: asRef(createdBy),
    waitingTimeMinutes: input.waitingTimeMinutes ?? 0,
    lastModifiedBy: asRef(createdBy),
    lastModifiedAt: new Date(),
    manualReviewRequired: false,
    duplicateConfirmed: Boolean(input.duplicateConfirmed),
    awaitingFullData,
    isDemo,
    referral: {
      destination: "",
      reason: "",
    },
    version: 0,
    explanation: {
      topFactor: "",
      contributors: [],
    },
  });

  const aiState = getPatientAi(patient);
  patient.ai = {
    riskFlags: Array.from(new Set([...(aiState.riskFlags ?? []), ...getDerivedRiskFlags(patient)])),
    criticalRiskConfidence: aiState.criticalRiskConfidence,
    summary: aiState.summary,
    llmStatus: aiState.llmStatus,
  } as never;
  await syncPatientPriorityAndExplanation(patient, createdBy, isDemo ? "simulation" : "manual");
  addVitalsHistorySnapshot(patient, isDemo ? "simulation" : "manual");
  return patient;
};

export const listQueuePatients = async (role: Role) => {
  const patients = await PatientModel.find({ status: { $in: ACTIVE_QUEUE_STATUSES } }).sort({ createdAt: -1 });
  return sortQueue(patients.map((patient) => mapPatientToQueueResponse(patient, role)));
};

export const getPatientDetails = async (patientId: string, role: Role) => {
  if (role === Role.Viewer) {
    throw new ApiError(403, "Viewer role cannot access patient details");
  }

  const patient = await PatientModel.findOne({ patientId });

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  return mapPatientToDetailsResponse(patient);
};

export const previewPatientIntake = async (input: IntakePreviewInput) => {
  const [duplicate, llmAnalysis] = await Promise.all([
    isDuplicatePatient({
      name: input.name,
      age: input.age,
      gender: input.gender,
    }),
    runAnalysis(input),
  ]);

  return {
    duplicate: duplicate
      ? {
          detected: true,
          patientId: duplicate.patientId,
          message: "Possible duplicate patient detected",
        }
      : {
          detected: false,
        },
    llm: {
      status: llmAnalysis.status,
      normalizedSymptoms: llmAnalysis.normalized_symptoms,
      riskFlags: llmAnalysis.risk_flags,
      criticalRiskConfidence: llmAnalysis.critical_risk_confidence,
      summary: llmAnalysis.summary,
    },
  };
};

export const getPatientGuidance = async (
  patientId: string,
  promptKey: PatientGuidancePromptKey,
  role: Role,
): Promise<PatientGuidanceResponse> => {
  if (![Role.Doctor, Role.Nurse].includes(role)) {
    throw new ApiError(403, "Only doctor and nurse roles can use patient guidance");
  }

  const patient = await PatientModel.findOne({ patientId });

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  const guidance = await createPatientGuidance({
    promptKey,
    patient: buildPatientGuidanceContext(patient),
  });

  return {
    promptKey,
    ...guidance,
  };
};

export const createPatient = async (input: CreatePatientInput, createdBy: string) => {
  const duplicate = await isDuplicatePatient({
    name: input.name,
    age: input.age,
    gender: input.gender,
  });

  if (duplicate && !input.duplicateConfirmed) {
    throw new ApiError(409, "Possible duplicate patient detected", {
      duplicate: {
        detected: true,
        patientId: duplicate.patientId,
        message: "Possible duplicate patient detected",
      },
    });
  }

  const llmAnalysis = await runAnalysis(input);

  if (input.symptoms.otherText.trim() && !input.confirmedNormalizedSymptoms) {
    throw new ApiError(400, "Normalized symptoms must be confirmed before saving");
  }

  const sequenceNumber = await getNextPatientSequence();
  const patient = await buildPatientDocument({
    sequenceNumber,
    input,
    llmAnalysis,
    createdBy,
    dataSource: DataSource.Manual,
    status: PatientStatus.Waiting,
    awaitingFullData: false,
    isDemo: false,
  });

  await patient.save();

  await createAuditLog({
    eventType: AuditEventType.PatientCreated,
    userId: createdBy,
    patientId: patient._id.toString(),
    newValue: {
      patientId: patient.patientId,
      priority: patient.priority,
      status: patient.status,
    },
    metadata: {
      duplicateConfirmed: Boolean(input.duplicateConfirmed),
      llmStatus: llmAnalysis.status,
    },
  });

  if (
    input.confirmedNormalizedSymptoms &&
    JSON.stringify(input.confirmedNormalizedSymptoms) !== JSON.stringify(llmAnalysis.normalized_symptoms)
  ) {
    await createAuditLog({
      eventType: AuditEventType.LlmSymptomCorrection,
      userId: createdBy,
      patientId: patient._id.toString(),
      oldValue: llmAnalysis.normalized_symptoms,
      newValue: input.confirmedNormalizedSymptoms,
      metadata: {
        originalSummary: llmAnalysis.summary,
      },
    });
  }

  return patient;
};

export const createQuickEntryPatient = async (input: QuickEntryInput, createdBy: string) => {
  const duplicate = await isDuplicatePatient({
    name: input.name,
    age: input.age,
    gender: input.gender,
  });

  if (duplicate && !input.duplicateConfirmed) {
    throw new ApiError(409, "Possible duplicate patient detected", {
      duplicate: {
        detected: true,
        patientId: duplicate.patientId,
        message: "Possible duplicate patient detected",
      },
    });
  }

  const quickEntryPayload: CreatePatientInput = {
    name: input.name,
    age: input.age,
    gender: input.gender,
    symptoms: {
      controlled: input.controlledSymptoms ?? [],
      otherText: input.otherText?.trim() ?? "",
    },
    vitals: input.vitals,
    injuryIncident: emptyInjury(),
    history: emptyHistory(),
    duplicateConfirmed: input.duplicateConfirmed,
    waitingTimeMinutes: 0,
    confirmedNormalizedSymptoms: input.otherText?.trim() ? [input.otherText.trim()] : [],
  };

  const llmAnalysis =
    input.otherText?.trim()
      ? await runAnalysis(quickEntryPayload)
      : {
          status: LlmStatus.Fallback,
          risk_flags: [],
          critical_risk_confidence: 0,
          summary: "AI analysis unavailable. Score based on rule engine only.",
          normalized_symptoms: [],
        };

  const sequenceNumber = await getNextPatientSequence();
  const patient = await buildPatientDocument({
    sequenceNumber,
    input: quickEntryPayload,
    llmAnalysis,
    createdBy,
    dataSource: DataSource.Manual,
    status: PatientStatus.Waiting,
    awaitingFullData: true,
    isDemo: false,
  });

  const hardCriticalFactor = getHardCriticalFactor(getPatientVitals(patient), getPatientInjury(patient));
  if (hardCriticalFactor) {
    patient.priority = Priority.Critical;
    patient.score = 100;
    patient.explanation = {
      topFactor: hardCriticalFactor,
      contributors: [hardCriticalFactor, "Immediate life-threatening condition detected"],
    };
  }

  await patient.save();

  await createAuditLog({
    eventType: AuditEventType.PatientCreated,
    userId: createdBy,
    patientId: patient._id.toString(),
    newValue: {
      patientId: patient.patientId,
      priority: patient.priority,
      status: patient.status,
      awaitingFullData: true,
    },
    metadata: {
      flow: "quick_entry",
      hardCriticalTriggered: Boolean(hardCriticalFactor),
    },
  });

  return patient;
};

const assertVersion = (patient: HydratedDocument<PatientDocument>, version: number) => {
  if (patient.version !== version) {
    throw new ApiError(409, "Record was updated by another source. Please refresh and retry.");
  }
};

export const updatePatientRecord = async (
  patientId: string,
  updates: UpdatePatientInput,
  userId: string,
  role: Role,
) => {
  if (role === Role.Viewer) {
    throw new ApiError(403, "Viewer role cannot update patients");
  }

  const patient = await PatientModel.findOne({ patientId });

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  assertVersion(patient, updates.version);

  const previousVitals = serializeVitalsForHistory(patient);
  const previousNotes = patient.doctorNotes;

  if (updates.symptoms) {
    if (updates.symptoms.controlled) {
      getPatientSymptoms(patient).controlled = updates.symptoms.controlled;
    }

    if (typeof updates.symptoms.otherText === "string") {
      getPatientSymptoms(patient).otherText = updates.symptoms.otherText.trim();
      getPatientSymptoms(patient).inputMode = getPatientSymptoms(patient).otherText
        ? SymptomInputMode.Other
        : SymptomInputMode.Controlled;

      const analysis = await runAnalysis({
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        symptoms: {
          controlled: getPatientSymptoms(patient).controlled,
          otherText: getPatientSymptoms(patient).otherText,
        },
        vitals: serializeVitalsForHistory(patient),
        injuryIncident: getPatientInjury(patient),
        history: getPatientHistory(patient),
      });

      patient.ai = {
        riskFlags: analysis.risk_flags,
        criticalRiskConfidence: analysis.critical_risk_confidence,
        summary: analysis.summary,
        llmStatus: analysis.status,
      };
      getPatientSymptoms(patient).llmOriginalNormalizedSymptoms = analysis.normalized_symptoms;

      if (updates.symptoms.confirmedNormalizedSymptoms) {
        getPatientSymptoms(patient).normalizedSymptoms = updates.symptoms.confirmedNormalizedSymptoms;
        getPatientSymptoms(patient).nurseConfirmedSymptoms = true;

        if (
          JSON.stringify(updates.symptoms.confirmedNormalizedSymptoms) !== JSON.stringify(analysis.normalized_symptoms)
        ) {
          await createAuditLog({
            eventType: AuditEventType.LlmSymptomCorrection,
            userId,
            patientId: patient._id.toString(),
            oldValue: analysis.normalized_symptoms,
            newValue: updates.symptoms.confirmedNormalizedSymptoms,
          });
        }
      } else {
        getPatientSymptoms(patient).normalizedSymptoms = analysis.normalized_symptoms;
      }
    }
  }

  if (updates.vitals) {
    for (const [key, value] of Object.entries(updates.vitals) as Array<
      [keyof PatientVitals, { value: number | null; dataSource?: DataSource }]
    >) {
      if (!value) {
        continue;
      }

      getPatientVitals(patient)[key] = {
        value: value.value,
        dataSource: value.dataSource ?? DataSource.Manual,
      };
    }
  }

  if (updates.injuryIncident) {
    patient.injuryIncident = {
      ...getPatientInjury(patient),
      ...updates.injuryIncident,
    } as never;
  }

  if (updates.history) {
    patient.history = {
      ...getPatientHistory(patient),
      ...updates.history,
    } as never;
  }

  if (typeof updates.doctorNotes === "string") {
    patient.doctorNotes = updates.doctorNotes;
  }

  patient.lastModifiedBy = asRef(userId);
  patient.lastModifiedAt = new Date();
  patient.version += 1;
  patient.awaitingFullData = false;

  const existingAi = getPatientAi(patient);
  patient.ai = {
    riskFlags: Array.from(new Set([...(existingAi.riskFlags ?? []), ...getDerivedRiskFlags(patient)])),
    criticalRiskConfidence: existingAi.criticalRiskConfidence,
    summary: existingAi.summary,
    llmStatus: existingAi.llmStatus,
  } as never;
  await syncPatientPriorityAndExplanation(patient, userId, "manual");
  addVitalsHistorySnapshot(patient, "manual");
  await patient.save();

  if (JSON.stringify(previousVitals) !== JSON.stringify(serializeVitalsForHistory(patient))) {
    await createAuditLog({
      eventType: AuditEventType.VitalsUpdated,
      userId,
      patientId: patient._id.toString(),
      oldValue: previousVitals,
      newValue: serializeVitalsForHistory(patient),
      metadata: {
        source: "manual",
      },
    });
  }

  if (previousNotes !== patient.doctorNotes) {
    await createAuditLog({
      eventType: AuditEventType.PatientStatusChanged,
      userId,
      patientId: patient._id.toString(),
      oldValue: { doctorNotes: previousNotes },
      newValue: { doctorNotes: patient.doctorNotes },
      metadata: {
        type: "doctor_notes_update",
      },
    });
  }

  return patient;
};

export const updatePatientStatus = async (
  patientId: string,
  updates: StatusUpdateInput,
  userId: string,
  role: Role,
) => {
  if (role === Role.Viewer) {
    throw new ApiError(403, "Viewer role cannot update patient status");
  }

  const patient = await PatientModel.findOne({ patientId });

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  assertVersion(patient, updates.version);

  if (updates.status === PatientStatus.Referred) {
    if (!updates.referral?.destination.trim() || !updates.referral?.reason.trim()) {
      throw new ApiError(400, "Referral destination and reason are required");
    }
  }

  const oldStatus = patient.status;
  patient.status = updates.status;
  patient.lastModifiedBy = asRef(userId);
  patient.lastModifiedAt = new Date();
  patient.version += 1;

  if (updates.referral) {
    patient.referral = updates.referral;
  }

  if (updates.clearManualReview) {
    patient.manualReviewRequired = false;
  }

  await applyOverrideExpiryRules(patient, updates.status, userId);
  await syncPatientPriorityAndExplanation(patient, userId, "manual");
  await patient.save();

  await createAuditLog({
    eventType: AuditEventType.PatientStatusChanged,
    userId,
    patientId: patient._id.toString(),
    oldValue: oldStatus,
    newValue: updates.status,
    metadata: updates.referral ? { referral: updates.referral } : {},
  });

  return patient;
};

export const applyDoctorOverride = async (
  patientId: string,
  input: OverrideInput,
  userId: string,
) => {
  const patient = await PatientModel.findOne({ patientId });

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  assertVersion(patient, input.version);

  if (!input.scope.trim()) {
    throw new ApiError(400, "Override scope is required");
  }

  const oldValue = {
    isActive: patient.doctorOverride?.isActive ?? false,
    priority: patient.doctorOverride?.priority ?? null,
    scope: patient.doctorOverride?.scope ?? "",
  };

  patient.doctorOverride = {
    isActive: true,
    priority: input.priority,
    scope: input.scope.trim(),
    appliedBy: asRef(userId),
    appliedAt: new Date(),
    clearedAt: null,
  };
  patient.overrideFlag = true;
  patient.overrideScope = input.scope.trim();
  patient.lastModifiedBy = asRef(userId);
  patient.lastModifiedAt = new Date();
  patient.version += 1;

  await syncPatientPriorityAndExplanation(patient, userId, "manual");
  await patient.save();

  await createAuditLog({
    eventType: AuditEventType.DoctorOverrideApplied,
    userId,
    patientId: patient._id.toString(),
    oldValue,
    newValue: {
      isActive: true,
      priority: input.priority,
      scope: input.scope.trim(),
    },
  });

  return patient;
};

export const clearDoctorOverride = async (patientId: string, version: number, userId: string) => {
  const patient = await PatientModel.findOne({ patientId });

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  assertVersion(patient, version);

  const oldValue = {
    isActive: patient.doctorOverride?.isActive ?? false,
    priority: patient.doctorOverride?.priority ?? null,
    scope: patient.doctorOverride?.scope ?? "",
  };

  patient.doctorOverride = {
    ...patient.doctorOverride,
    isActive: false,
    priority: null,
    scope: "",
    clearedAt: new Date(),
  };
  patient.overrideFlag = false;
  patient.overrideScope = "";
  patient.lastModifiedBy = asRef(userId);
  patient.lastModifiedAt = new Date();
  patient.version += 1;

  await syncPatientPriorityAndExplanation(patient, userId, "manual");
  await patient.save();

  await createAuditLog({
    eventType: AuditEventType.DoctorOverrideCleared,
    userId,
    patientId: patient._id.toString(),
    oldValue,
    newValue: {
      isActive: false,
    },
  });

  return patient;
};

export const deletePatientRecord = async (patientId: string, userId: string, role: Role) => {
  if (role !== Role.Doctor) {
    throw new ApiError(403, "Only doctors can delete patient records");
  }

  const patient = await PatientModel.findOne({ patientId });

  if (!patient) {
    throw new ApiError(404, "Patient not found");
  }

  await createAuditLog({
    eventType: AuditEventType.PatientDeleted,
    userId,
    patientId: patient._id.toString(),
    oldValue: {
      patientId: patient.patientId,
      name: patient.name,
      priority: patient.priority,
      status: patient.status,
      isDemo: patient.isDemo,
    },
    metadata: {
      deletedPatientId: patient.patientId,
      deletedAt: new Date().toISOString(),
    },
  });

  await PatientModel.deleteOne({ _id: patient._id });

  return {
    patientId: patient.patientId,
  };
};

export const listPatientAnalytics = async () => {
  const patients = await PatientModel.find({ status: { $in: ACTIVE_QUEUE_STATUSES } }).sort({ score: -1 }).limit(10);

  return patients.map((patient) => ({
    patientId: patient.patientId,
    name: patient.name,
    score: patient.score,
    priority: patient.priority,
  }));
};

export const processSimulationTick = async () => {
  const config = await getOrCreateSystemConfig();

  if (!config.simulationEnabled) {
    return [];
  }

  const patients = await PatientModel.find({
    isDemo: true,
    status: { $in: [PatientStatus.Waiting, PatientStatus.InTreatment] },
  });

  const updates: string[] = [];

  for (const patient of patients) {
    const vitals = getPatientVitals(patient);
    const currentPriority = patient.priority;
    const simulationSeed = getPatientSimulationSeed(patient.patientId);
    const applyDrift = (value: number | null, delta: number, min: number, max: number) =>
      value === null ? value : clamp(Number((value + delta).toFixed(1)), min, max);

    if (vitals.oxygenSaturation.dataSource === DataSource.Simulation) {
      if (currentPriority === Priority.Critical) {
        vitals.oxygenSaturation.value = driftWithinBand(vitals.oxygenSaturation.value ?? null, {
          min: 70,
          max: 86,
          center: 78 + getSeededOffset(simulationSeed + 11, 3.2),
          volatility: 3.6,
          recenterStrength: 0.18,
        });
      } else {
        const delta = currentPriority === Priority.Urgent ? (Math.random() - 0.55) * 1.9 : (Math.random() - 0.5) * 1.4;
        vitals.oxygenSaturation.value = applyDrift(vitals.oxygenSaturation.value ?? null, delta, 70, 100);
      }
    }

    if (vitals.bloodPressureSystolic.dataSource === DataSource.Simulation) {
      if (currentPriority === Priority.Critical) {
        vitals.bloodPressureSystolic.value = driftWithinBand(vitals.bloodPressureSystolic.value ?? null, {
          min: 64,
          max: 92,
          center: 77 + getSeededOffset(simulationSeed + 23, 6.5),
          volatility: 7.2,
          recenterStrength: 0.2,
        });
      } else {
        const delta = (Math.random() - 0.5) * (currentPriority === Priority.Urgent ? 4.2 : 3);
        vitals.bloodPressureSystolic.value = applyDrift(vitals.bloodPressureSystolic.value ?? null, delta, 60, 200);
      }
    }

    if (vitals.bloodPressureDiastolic.dataSource === DataSource.Simulation) {
      if (currentPriority === Priority.Critical) {
        vitals.bloodPressureDiastolic.value = driftWithinBand(vitals.bloodPressureDiastolic.value ?? null, {
          min: 36,
          max: 60,
          center: 48 + getSeededOffset(simulationSeed + 37, 5.2),
          volatility: 5.6,
          recenterStrength: 0.2,
        });
      } else {
        const delta = (Math.random() - 0.5) * (currentPriority === Priority.Urgent ? 3.1 : 2);
        vitals.bloodPressureDiastolic.value = applyDrift(vitals.bloodPressureDiastolic.value ?? null, delta, 35, 120);
      }
    }

    if (vitals.heartRate.dataSource === DataSource.Simulation) {
      if (currentPriority === Priority.Critical) {
        vitals.heartRate.value = driftWithinBand(vitals.heartRate.value ?? null, {
          min: 122,
          max: 156,
          center: 139 + getSeededOffset(simulationSeed + 41, 8.5),
          volatility: 9.5,
          recenterStrength: 0.16,
        });
      } else {
        const delta = (Math.random() - 0.5) * (currentPriority === Priority.Urgent ? 7 : 5);
        vitals.heartRate.value = applyDrift(vitals.heartRate.value ?? null, delta, 35, 160);
      }
    }

    if (vitals.temperature.dataSource === DataSource.Simulation) {
      if (currentPriority === Priority.Critical) {
        vitals.temperature.value = driftWithinBand(vitals.temperature.value ?? null, {
          min: 98.8,
          max: 104.2,
          center: 101.4 + getSeededOffset(simulationSeed + 53, 0.9),
          volatility: 0.9,
          recenterStrength: 0.14,
        });
      } else {
        const delta = currentPriority === Priority.Urgent ? (Math.random() - 0.45) * 0.45 : (Math.random() - 0.5) * 0.3;
        vitals.temperature.value = applyDrift(vitals.temperature.value ?? null, delta, 95, 105);
      }
    }

    if (vitals.bloodSugar.dataSource === DataSource.Simulation) {
      if (currentPriority === Priority.Critical) {
        vitals.bloodSugar.value = driftWithinBand(vitals.bloodSugar.value ?? null, {
          min: 82,
          max: 260,
          center: 168 + getSeededOffset(simulationSeed + 67, 42),
          volatility: 24,
          recenterStrength: 0.16,
        });
      } else {
        const delta = currentPriority === Priority.Urgent ? (Math.random() - 0.45) * 16 : (Math.random() - 0.5) * 12;
        vitals.bloodSugar.value = applyDrift(vitals.bloodSugar.value ?? null, delta, 45, 420);
      }
    }

    patient.waitingTimeMinutes += config.simulationTickSeconds / 60;
    patient.lastModifiedAt = new Date();
    patient.version += 1;

    await syncPatientPriorityAndExplanation(patient, patient.createdBy.toString(), "simulation");
    addVitalsHistorySnapshot(patient, "simulation");
    await patient.save();

    await createAuditLog({
      eventType: AuditEventType.VitalsUpdated,
      userId: patient.createdBy.toString(),
      patientId: patient._id.toString(),
      newValue: serializeVitalsForHistory(patient),
      metadata: {
        source: "simulation",
      },
    });

    updates.push(patient.patientId);
  }

  return updates;
};

export const generateDemoPatients = async (
  count: number,
  createdBy: string,
  analyzePatient = createLLMAnalysis,
) => {
  const createdPatients: HydratedDocument<PatientDocument>[] = [];

  for (let index = 0; index < count; index += 1) {
    const scenario = demoScenarios[index % demoScenarios.length];
    const { name, gender } = buildName();
    const llmAnalysis = await analyzePatient({
      symptoms: scenario.otherText,
      vitals: scenario.vitals,
      injury: scenario.injury,
      history: scenario.history,
    });

    const patient = await buildPatientDocument({
      sequenceNumber: await getNextPatientSequence(),
      input: {
        name,
        age: randomAge(),
        gender,
        symptoms: {
          controlled: scenario.controlledSymptoms,
          otherText: scenario.otherText,
        },
        vitals: scenario.vitals,
        injuryIncident: scenario.injury,
        history: scenario.history,
        confirmedNormalizedSymptoms: llmAnalysis.normalized_symptoms,
        waitingTimeMinutes: scenario.waitingTimeMinutes,
      },
      llmAnalysis,
      createdBy,
      dataSource: DataSource.Simulation,
      status: PatientStatus.Waiting,
      awaitingFullData: false,
      isDemo: true,
    });

    await patient.save();
    createdPatients.push(patient);

    await createAuditLog({
      eventType: AuditEventType.PatientCreated,
      userId: createdBy,
      patientId: patient._id.toString(),
      newValue: {
        patientId: patient.patientId,
        priority: patient.priority,
        status: patient.status,
      },
      metadata: {
        flow: "demo_generator",
      },
    });
  }

  return sortQueue(createdPatients.map((patient) => mapPatientToQueueResponse(patient, Role.Doctor)));
};
