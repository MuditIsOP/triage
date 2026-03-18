import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { LlmStatus, RiskFlag, Role } from "@er-triage/shared";

const run = async () => {
  const mongoServer = await MongoMemoryServer.create();

  process.env.PORT = "5000";
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.JWT_SECRET = "smoke-test-secret";
  process.env.XAI_API_KEY = "smoke-test-xai-key";
  process.env.XAI_BASE_URL = "https://api.x.ai/v1";
  process.env.XAI_MODEL = "grok-3";
  process.env.SEED_ENABLED = "false";

  const [{ connectToDatabase }, { generateDemoPatients, listQueuePatients }] = await Promise.all([
    import("../config/database"),
    import("../services/patient.service"),
  ]);

  await connectToDatabase();

  const mockAnalyzer = async ({ symptoms }: { symptoms: string }) => {
    const lowerSymptoms = symptoms.toLowerCase();

    if (lowerSymptoms.includes("chest tightness")) {
      return {
        status: LlmStatus.Success,
        risk_flags: [RiskFlag.CardiacRisk],
        critical_risk_confidence: 84,
        summary: "Cardiac symptoms require urgent evaluation.",
        normalized_symptoms: ["chest tightness", "sweating"],
      };
    }

    if (lowerSymptoms.includes("shortness of breath")) {
      return {
        status: LlmStatus.Success,
        risk_flags: [RiskFlag.BreathingIssue],
        critical_risk_confidence: 88,
        summary: "Breathing difficulty increases respiratory risk.",
        normalized_symptoms: ["fever", "breathing difficulty"],
      };
    }

    if (lowerSymptoms.includes("bleeding")) {
      return {
        status: LlmStatus.Success,
        risk_flags: [RiskFlag.ExternalBleeding, RiskFlag.Trauma],
        critical_risk_confidence: 76,
        summary: "Bleeding and trauma require fast assessment.",
        normalized_symptoms: ["bleeding", "dizziness"],
      };
    }

    return {
      status: LlmStatus.Fallback,
      risk_flags: [],
      critical_risk_confidence: 0,
      summary: "AI analysis unavailable. Score based on rule engine only.",
      normalized_symptoms: [],
    };
  };

  const onePatient = await generateDemoPatients(1, new mongoose.Types.ObjectId().toString(), mockAnalyzer);
  assert.equal(onePatient.length, 1);

  const tenPatients = await generateDemoPatients(10, new mongoose.Types.ObjectId().toString(), mockAnalyzer);
  assert.equal(tenPatients.length, 10);

  const queue = await listQueuePatients(Role.Doctor);
  assert.ok(queue.length >= 11);
  assert.ok(queue.some((patient) => patient.priority === "critical"));
  assert.ok(queue.some((patient) => patient.priority === "urgent"));
  assert.ok(queue.some((patient) => patient.priority === "normal"));

  await mongoose.disconnect();
  await mongoServer.stop();

  console.log("Demo smoke test passed.");
};

void run();
