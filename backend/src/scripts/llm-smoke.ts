import assert from "node:assert/strict";
import { LlmStatus, RiskFlag } from "@er-triage/shared";

process.env.PORT = "5000";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/er-triage";
process.env.JWT_SECRET = "smoke-test-secret";
process.env.XAI_API_KEY = "smoke-test-xai-key";
process.env.XAI_BASE_URL = "https://api.x.ai/v1";
process.env.AI_REQUEST_TIMEOUT_SECONDS = "30";
process.env.AI_MAX_TOKENS = "500";
process.env.XAI_MODEL = "grok-3";

const run = async () => {
  const { createLLMAnalysis, getApiKey, getModel } = await import("../services/llm.service");

  assert.equal(getApiKey(), "smoke-test-xai-key");
  assert.equal(getModel(), "grok-3");

  const successResult = await createLLMAnalysis(
    {
      symptoms: "chest tightness and dizziness",
      vitals: { oxygenSaturation: 93, heartRate: 118 },
      injury: { type: "", severity: null, bleeding: false },
      history: { diabetes: false, hypertension: true, heartDisease: false },
    },
    {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    risk_flags: [RiskFlag.CardiacRisk],
                    critical_risk_confidence: 82,
                    summary: "Cardiac symptoms with elevated heart rate indicate urgent review.",
                    normalized_symptoms: ["chest tightness", "dizziness"],
                  }),
                },
              },
            ],
          }),
        },
      },
    },
  );

  assert.equal(successResult.status, LlmStatus.Success);
  assert.deepEqual(successResult.risk_flags, [RiskFlag.CardiacRisk]);

  const fallbackResult = await createLLMAnalysis(
    {
      symptoms: "shortness of breath",
      vitals: { oxygenSaturation: 88 },
      injury: { type: "", severity: null, bleeding: false },
      history: { diabetes: false, hypertension: false, heartDisease: false },
    },
    {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                finish_reason: "length",
                message: {
                  content: "",
                },
              },
            ],
          }),
        },
      },
    },
  );

  assert.equal(fallbackResult.status, LlmStatus.Fallback);
  assert.deepEqual(fallbackResult.risk_flags, []);

  const failedResult = await createLLMAnalysis(
    {
      symptoms: "head injury",
      vitals: { oxygenSaturation: 97 },
      injury: { type: "Head Injury", severity: "severe", bleeding: true },
      history: { diabetes: false, hypertension: false, heartDisease: false },
    },
    {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: "{invalid-json",
                },
              },
            ],
          }),
        },
      },
    },
  );

  assert.equal(failedResult.status, LlmStatus.Failed);
  assert.deepEqual(failedResult.risk_flags, []);

  console.log("LLM smoke test passed.");
};

void run();
