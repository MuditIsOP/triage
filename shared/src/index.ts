export enum Role {
  Doctor = "doctor",
  Nurse = "nurse",
  Viewer = "viewer",
}

export enum Priority {
  Critical = "critical",
  Urgent = "urgent",
  Normal = "normal",
}

export enum RiskFlag {
  AirwayIssue = "airway_issue",
  BreathingIssue = "breathing_issue",
  CirculationIssue = "circulation_issue",
  NeurologicalRisk = "neurological_risk",
  ExternalBleeding = "external_bleeding",
  InternalBleeding = "internal_bleeding",
  Trauma = "trauma",
  CardiacRisk = "cardiac_risk",
  InfectionRisk = "infection_risk",
  ShockRisk = "shock_risk",
}

export enum LlmStatus {
  Success = "success",
  Fallback = "fallback",
  Failed = "failed",
}

export enum AuditEventType {
  PatientCreated = "patient_created",
  PatientDeleted = "patient_deleted",
  VitalsUpdated = "vitals_updated",
  PriorityChanged = "priority_changed",
  DoctorOverrideApplied = "doctor_override_applied",
  DoctorOverrideCleared = "doctor_override_cleared",
  BedAssigned = "bed_assigned",
  BedReleased = "bed_released",
  PatientStatusChanged = "patient_status_changed",
  LlmSymptomCorrection = "llm_symptom_correction",
  SystemReset = "system_reset",
  NurseCreated = "nurse_created",
  NurseRemoved = "nurse_removed",
}

export enum PatientStatus {
  Waiting = "waiting",
  InTreatment = "in_treatment",
  Completed = "completed",
  Discharged = "discharged",
  Referred = "referred",
}

export enum SymptomInputMode {
  Controlled = "controlled",
  Other = "other",
}

export enum InjurySeverity {
  Minor = "minor",
  Moderate = "moderate",
  Severe = "severe",
}

export enum DataSource {
  Manual = "manual",
  Simulation = "simulation",
}

export enum PatientGuidancePromptKey {
  PredictedProblem = "predicted_problem",
  CarePriorities = "care_priorities",
  DosAndDonts = "dos_and_donts",
  MonitoringFocus = "monitoring_focus",
  HandoffSummary = "handoff_summary",
}

export type Gender = "male" | "female" | "other";

export interface VitalsField<T> {
  value: T | null;
  dataSource: DataSource;
}

export interface PatientVitals {
  heartRate: VitalsField<number>;
  bloodPressureSystolic: VitalsField<number>;
  bloodPressureDiastolic: VitalsField<number>;
  temperature: VitalsField<number>;
  oxygenSaturation: VitalsField<number>;
  bloodSugar: VitalsField<number>;
}

export interface PatientSymptoms {
  controlled: string[];
  otherText: string;
  inputMode: SymptomInputMode;
}

export interface PatientHistory {
  diabetes: boolean;
  hypertension: boolean;
  heartDisease: boolean;
  other: string;
}

export interface InjuryIncident {
  type: string;
  severity: InjurySeverity | null;
  bleeding: boolean;
  unconsciousReported: boolean;
}

export interface PatientAiData {
  normalizedSymptoms: string[];
  llmOriginalNormalizedSymptoms: string[];
  nurseConfirmedSymptoms: boolean;
  riskFlags: RiskFlag[];
  criticalRiskConfidence: number;
  summary: string;
  llmStatus: LlmStatus;
}

export interface DoctorOverride {
  isActive: boolean;
  priority: Priority | null;
  scope: string;
  appliedBy: string | null;
  appliedAt: string | null;
  clearedAt: string | null;
}

export interface ReferralInfo {
  destination: string;
  reason: string;
}

export interface BedAssignment {
  bedId: string | null;
  bedType: "general" | "critical" | null;
  priorityMismatch: boolean;
}

export interface BedReallocationState {
  state: "none" | "reassigned" | "transferring";
  message: string;
  displacedByPatientId: string | null;
  updatedAt: string | null;
}

export interface Patient {
  patientId: string;
  name: string;
  age: number;
  gender: Gender;
  symptoms: PatientSymptoms;
  vitals: PatientVitals;
  injuryIncident: InjuryIncident;
  history: PatientHistory;
  ai: PatientAiData;
  score: number;
  priority: Priority;
  status: PatientStatus;
  bedAssignment: BedAssignment;
  bedReallocation: BedReallocationState;
  doctorNotes: string;
  doctorOverride: DoctorOverride;
  createdBy: string;
  createdAt: string;
  waitingTimeMinutes: number;
  lastModifiedBy: string | null;
  lastModifiedAt: string | null;
  manualReviewRequired: boolean;
  duplicateConfirmed: boolean;
  awaitingFullData: boolean;
  isDemo: boolean;
  referral: ReferralInfo;
  version: number;
}
