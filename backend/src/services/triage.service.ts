import {
  InjurySeverity,
  LlmStatus,
  Priority,
  RiskFlag,
  type PatientAiData,
  type PatientHistory,
  type PatientSymptoms,
  type PatientVitals,
  type DoctorOverride,
  type InjuryIncident,
} from "@er-triage/shared";

type Contributor = {
  message: string;
  impact: number;
};

export type TriageInput = {
  vitals: PatientVitals;
  symptoms: PatientSymptoms & {
    normalizedSymptoms?: string[];
  };
  injury: InjuryIncident;
  history: PatientHistory;
  ai: Pick<PatientAiData, "riskFlags" | "criticalRiskConfidence" | "llmStatus">;
  doctorOverride?: DoctorOverride | null;
  waitingTimeMinutes?: number;
  currentPriority?: Priority | null;
};

export type TriageResult = {
  priority: Priority;
  score: number;
  explanation: {
    top_factor: string;
    contributors: string[];
  };
  manualReviewRequired: boolean;
  escalationScore: number;
};

const PRIORITY_LEVELS: Record<Priority, number> = {
  [Priority.Normal]: 0,
  [Priority.Urgent]: 1,
  [Priority.Critical]: 2,
};

const CRITICAL_AI_RISK_FLAGS = new Set<RiskFlag>([
  RiskFlag.AirwayIssue,
  RiskFlag.BreathingIssue,
  RiskFlag.CirculationIssue,
  RiskFlag.NeurologicalRisk,
  RiskFlag.ExternalBleeding,
  RiskFlag.InternalBleeding,
  RiskFlag.CardiacRisk,
  RiskFlag.ShockRisk,
  RiskFlag.Trauma,
]);

const SYMPTOM_WEIGHTS: Array<{ terms: string[]; points: number; explanation: string }> = [
  { terms: ["chest pain", "chest tightness"], points: 22, explanation: "Cardiac-type symptoms increase urgency" },
  { terms: ["shortness of breath", "breathing difficulty", "respiratory distress"], points: 22, explanation: "Breathing symptoms increase risk" },
  { terms: ["head injury", "confusion", "unconscious"], points: 24, explanation: "Neurological symptoms increase risk" },
  { terms: ["bleeding", "active bleeding"], points: 20, explanation: "Reported bleeding increases trauma risk" },
  { terms: ["fever", "infection"], points: 12, explanation: "Infectious symptoms increase risk" },
  { terms: ["accident", "fall", "trauma"], points: 16, explanation: "Trauma-related symptoms increase urgency" },
];

const getNumericValue = (value: number | null | undefined) => (typeof value === "number" ? value : null);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const createContributorTracker = () => {
  const contributors: Contributor[] = [];

  return {
    add: (message: string, impact: number) => {
      contributors.push({ message, impact });
    },
    list: () => contributors,
    topFactor: () =>
      contributors.reduce<Contributor | null>(
        (top, current) => (!top || current.impact > top.impact ? current : top),
        null,
      )?.message ?? "Stable presentation",
  };
};

export const getHardCriticalFactor = (vitals: PatientVitals, injury: InjuryIncident) => {
  const oxygenSaturation = getNumericValue(vitals.oxygenSaturation.value);
  const systolic = getNumericValue(vitals.bloodPressureSystolic.value);
  const hasSevereBleeding = injury.bleeding && injury.severity === InjurySeverity.Severe;

  if (oxygenSaturation !== null && oxygenSaturation < 85) {
    return "SpO2 critically low (<85)";
  }

  if (systolic !== null && systolic < 70) {
    return "Low blood pressure detected";
  }

  if (hasSevereBleeding) {
    return "Severe bleeding detected";
  }

  if (injury.unconsciousReported) {
    return "Unconscious state reported";
  }

  return null;
};

const calculateVitalsScore = (vitals: PatientVitals, contributors: ReturnType<typeof createContributorTracker>) => {
  let raw = 0;

  const oxygenSaturation = getNumericValue(vitals.oxygenSaturation.value);
  if (oxygenSaturation !== null) {
    if (oxygenSaturation < 90) {
      raw += 32;
      contributors.add("Low oxygen saturation increases respiratory risk", 32);
    } else if (oxygenSaturation < 94) {
      raw += 16;
      contributors.add("Borderline oxygen saturation increases risk", 16);
    }
  }

  const systolic = getNumericValue(vitals.bloodPressureSystolic.value);
  if (systolic !== null) {
    if (systolic < 90) {
      raw += 24;
      contributors.add("Low blood pressure detected", 40);
    } else if (systolic > 180) {
      raw += 16;
      contributors.add("Severely elevated blood pressure increases risk", 16);
    }
  }

  const heartRate = getNumericValue(vitals.heartRate.value);
  if (heartRate !== null) {
    if (heartRate > 130 || heartRate < 40) {
      raw += 18;
      contributors.add("Heart rate is critically abnormal", 18);
    } else if (heartRate > 110 || heartRate < 50) {
      raw += 10;
      contributors.add("Abnormal heart rate increases risk", 10);
    }
  }

  const temperature = getNumericValue(vitals.temperature.value);
  if (temperature !== null) {
    if (temperature >= 39.5 || temperature < 35) {
      raw += 12;
      contributors.add("Temperature is significantly abnormal", 12);
    } else if (temperature >= 38) {
      raw += 6;
      contributors.add("Fever increases infection risk", 6);
    }
  }

  const bloodSugar = getNumericValue(vitals.bloodSugar.value);
  if (bloodSugar !== null) {
    if (bloodSugar < 60 || bloodSugar > 400) {
      raw += 16;
      contributors.add("Critically abnormal blood sugar increases risk", 16);
    } else if (bloodSugar < 70 || bloodSugar > 250) {
      raw += 8;
      contributors.add("Abnormal blood sugar increases risk", 8);
    }
  }

  return clamp(raw, 0, 100);
};

const calculateSymptomsScore = (
  symptoms: TriageInput["symptoms"],
  injury: InjuryIncident,
  contributors: ReturnType<typeof createContributorTracker>,
) => {
  const normalized = [
    ...symptoms.controlled,
    ...(symptoms.normalizedSymptoms ?? []),
    symptoms.otherText,
    injury.type,
  ]
    .join(" ")
    .toLowerCase();

  let raw = 0;

  for (const entry of SYMPTOM_WEIGHTS) {
    if (entry.terms.some((term) => normalized.includes(term))) {
      raw += entry.points;
      contributors.add(entry.explanation, entry.points);
    }
  }

  if (injury.bleeding) {
    raw += 10;
    contributors.add("Injury with bleeding increases urgency", 10);
  }

  if (injury.severity === InjurySeverity.Severe) {
    raw += 18;
    contributors.add("Severe injury reported", 18);
  } else if (injury.severity === InjurySeverity.Moderate) {
    raw += 10;
    contributors.add("Moderate injury contributes to risk", 10);
  }

  return clamp(raw, 0, 100);
};

const calculateHistoryScore = (
  history: PatientHistory,
  contributors: ReturnType<typeof createContributorTracker>,
) => {
  let raw = 0;

  if (history.diabetes) {
    raw += 28;
  }
  if (history.hypertension) {
    raw += 28;
  }
  if (history.heartDisease) {
    raw += 34;
  }
  if (history.other.trim().length > 0) {
    raw += 10;
  }

  if (raw > 0) {
    contributors.add("Patient history increases risk", raw);
  }

  return clamp(raw, 0, 100);
};

const mapScoreToPriority = (score: number) => {
  if (score >= 80) {
    return Priority.Critical;
  }

  if (score >= 50) {
    return Priority.Urgent;
  }

  return Priority.Normal;
};

const applyMinimumPriority = (current: Priority, minimum: Priority) =>
  PRIORITY_LEVELS[current] >= PRIORITY_LEVELS[minimum] ? current : minimum;

const applyPriorityLock = (nextPriority: Priority, currentPriority?: Priority | null) => {
  if (!currentPriority) {
    return nextPriority;
  }

  if (PRIORITY_LEVELS[nextPriority] >= PRIORITY_LEVELS[currentPriority]) {
    return nextPriority;
  }

  if (currentPriority === Priority.Critical) {
    return Priority.Urgent;
  }

  if (currentPriority === Priority.Urgent) {
    return Priority.Normal;
  }

  return Priority.Normal;
};

export const runTriage = (input: TriageInput): TriageResult => {
  const contributors = createContributorTracker();
  const riskFlags = input.ai.riskFlags ?? [];

  const hardCriticalFactor = getHardCriticalFactor(input.vitals, input.injury);
  if (hardCriticalFactor) {
    contributors.add(hardCriticalFactor, 100);
    contributors.add("Immediate life-threatening condition detected", 95);

    return {
      priority: Priority.Critical,
      score: 100,
      explanation: {
        top_factor: hardCriticalFactor,
        contributors: contributors.list().map((entry) => entry.message),
      },
      manualReviewRequired: false,
      escalationScore: 0,
    };
  }

  if (input.doctorOverride?.isActive && input.doctorOverride.priority) {
    contributors.add("Doctor override applied", 100);

    return {
      priority: input.doctorOverride.priority,
      score: 100,
      explanation: {
        top_factor: "Doctor override applied",
        contributors: ["Doctor override applied"],
      },
      manualReviewRequired: false,
      escalationScore: 0,
    };
  }

  const vitalsRaw = calculateVitalsScore(input.vitals, contributors);
  const symptomsRaw = calculateSymptomsScore(input.symptoms, input.injury, contributors);
  const historyRaw = calculateHistoryScore(input.history, contributors);

  const aiAvailable = input.ai.llmStatus === LlmStatus.Success;
  const aiConfidence = clamp(input.ai.criticalRiskConfidence ?? 0, 0, 100);
  const aiCriticalFlagPresent = riskFlags.some((flag) => CRITICAL_AI_RISK_FLAGS.has(flag));

  if (aiCriticalFlagPresent) {
    contributors.add(`AI detected ${riskFlags[0].replace(/_/g, " ")}`, 18);
  }

  if (aiAvailable && aiConfidence > 0) {
    contributors.add(`High AI confidence (${aiConfidence}%)`, Math.round((aiConfidence / 100) * 20));
  }

  const weightedScore = aiAvailable
    ? vitalsRaw * 0.4 + symptomsRaw * 0.3 + historyRaw * 0.1 + aiConfidence * 0.2
    : vitalsRaw * 0.5 + symptomsRaw * 0.375 + historyRaw * 0.125;

  const escalationScore = clamp(Math.floor((input.waitingTimeMinutes ?? 0) / 5) * 2, 0, 20);
  if (escalationScore > 0) {
    contributors.add("Extended waiting time increased priority", escalationScore);
    contributors.add(`Waiting time increased score by ${escalationScore} points`, escalationScore);
  }

  const score = clamp(Math.round(weightedScore + escalationScore), 0, 100);
  let priority = mapScoreToPriority(score);

  if (aiCriticalFlagPresent && aiConfidence >= 70) {
    priority = applyMinimumPriority(priority, Priority.Urgent);
  }

  const lockedPriority = applyPriorityLock(priority, input.currentPriority);
  const manualReviewRequired =
    escalationScore === 20 && lockedPriority === Priority.Normal && score < 50;

  if (manualReviewRequired) {
    contributors.add("Waiting time cap reached; manual review required", 20);
  }

  return {
    priority: lockedPriority,
    score,
    explanation: {
      top_factor: contributors.topFactor(),
      contributors: contributors.list().map((entry) => entry.message),
    },
    manualReviewRequired,
    escalationScore,
  };
};
