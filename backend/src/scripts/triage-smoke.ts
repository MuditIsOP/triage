import assert from "node:assert/strict";
import {
  DataSource,
  InjurySeverity,
  LlmStatus,
  Priority,
  RiskFlag,
  SymptomInputMode,
  type PatientVitals,
} from "@er-triage/shared";

const createVitals = (overrides?: Partial<Record<keyof PatientVitals, number | null>>): PatientVitals => ({
  heartRate: { value: overrides?.heartRate ?? 92, dataSource: DataSource.Manual },
  bloodPressureSystolic: { value: overrides?.bloodPressureSystolic ?? 118, dataSource: DataSource.Manual },
  bloodPressureDiastolic: { value: overrides?.bloodPressureDiastolic ?? 74, dataSource: DataSource.Manual },
  temperature: { value: overrides?.temperature ?? 37, dataSource: DataSource.Manual },
  oxygenSaturation: { value: overrides?.oxygenSaturation ?? 98, dataSource: DataSource.Manual },
  bloodSugar: { value: overrides?.bloodSugar ?? 110, dataSource: DataSource.Manual },
});

const run = async () => {
  const { runTriage } = await import("../services/triage.service");

  const lowOxygenResult = runTriage({
    vitals: createVitals({ oxygenSaturation: 82 }),
    symptoms: {
      controlled: ["shortness of breath"],
      otherText: "",
      inputMode: SymptomInputMode.Controlled,
      normalizedSymptoms: ["shortness of breath"],
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
    ai: {
      riskFlags: [],
      criticalRiskConfidence: 0,
      llmStatus: LlmStatus.Fallback,
    },
  });

  assert.equal(lowOxygenResult.priority, Priority.Critical);
  assert.equal(lowOxygenResult.score, 100);
  assert.ok(lowOxygenResult.explanation.contributors.includes("SpO2 critically low (<85)"));

  const severeBleedingResult = runTriage({
    vitals: createVitals(),
    symptoms: {
      controlled: ["bleeding"],
      otherText: "",
      inputMode: SymptomInputMode.Controlled,
      normalizedSymptoms: ["bleeding"],
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
    ai: {
      riskFlags: [],
      criticalRiskConfidence: 0,
      llmStatus: LlmStatus.Fallback,
    },
  });

  assert.equal(severeBleedingResult.priority, Priority.Critical);
  assert.ok(severeBleedingResult.explanation.contributors.includes("Severe bleeding detected"));

  const aiRiskResult = runTriage({
    vitals: createVitals(),
    symptoms: {
      controlled: ["chest tightness"],
      otherText: "",
      inputMode: SymptomInputMode.Controlled,
      normalizedSymptoms: ["chest tightness"],
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
      heartDisease: false,
      other: "",
    },
    ai: {
      riskFlags: [RiskFlag.CardiacRisk],
      criticalRiskConfidence: 85,
      llmStatus: LlmStatus.Success,
    },
  });

  assert.equal(aiRiskResult.priority, Priority.Urgent);
  assert.ok(aiRiskResult.explanation.contributors.some((entry) => entry.includes("AI detected cardiac risk")));
  assert.ok(aiRiskResult.explanation.contributors.some((entry) => entry.includes("High AI confidence (85%)")));

  const mixedCaseResult = runTriage({
    vitals: createVitals({ bloodPressureSystolic: 78, heartRate: 138 }),
    symptoms: {
      controlled: ["chest pain"],
      otherText: "",
      inputMode: SymptomInputMode.Controlled,
      normalizedSymptoms: ["chest pain"],
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
    ai: {
      riskFlags: [RiskFlag.CardiacRisk],
      criticalRiskConfidence: 72,
      llmStatus: LlmStatus.Success,
    },
  });

  assert.equal(mixedCaseResult.priority, Priority.Urgent);
  assert.equal(mixedCaseResult.explanation.top_factor, "Low blood pressure detected");

  const timeEscalationResult = runTriage({
    vitals: createVitals(),
    symptoms: {
      controlled: [],
      otherText: "",
      inputMode: SymptomInputMode.Controlled,
      normalizedSymptoms: [],
    },
    injury: {
      type: "",
      severity: InjurySeverity.Minor,
      bleeding: false,
      unconsciousReported: false,
    },
    history: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      other: "",
    },
    ai: {
      riskFlags: [],
      criticalRiskConfidence: 0,
      llmStatus: LlmStatus.Fallback,
    },
    waitingTimeMinutes: 50,
    currentPriority: Priority.Urgent,
  });

  assert.equal(timeEscalationResult.escalationScore, 20);
  assert.equal(timeEscalationResult.priority, Priority.Normal);
  assert.ok(
    timeEscalationResult.explanation.contributors.includes("Extended waiting time increased priority"),
  );

  console.log("Triage smoke test passed.");
};

void run();
