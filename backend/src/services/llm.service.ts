import OpenAI from "openai";
import { LlmStatus, PatientGuidancePromptKey, RiskFlag } from "@er-triage/shared";
import { env } from "../config/env";

const DEFAULT_XAI_MODEL = "grok-3";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_SUMMARY = "AI analysis unavailable. Score based on rule engine only.";
const ALLOWED_RISK_FLAGS = new Set(Object.values(RiskFlag));
type LlmProvider = "xai" | "groq";

export type LLMAnalysisInput = {
  symptoms: string;
  vitals: Record<string, unknown>;
  injury: Record<string, unknown>;
  history: Record<string, unknown>;
};

export type LLMAnalysisResult = {
  status: LlmStatus;
  risk_flags: RiskFlag[];
  critical_risk_confidence: number;
  summary: string;
  normalized_symptoms: string[];
};

export type PatientGuidanceInput = {
  promptKey: PatientGuidancePromptKey;
  patient: Record<string, unknown>;
};

export type PatientGuidanceResult = {
  status: LlmStatus;
  heading: string;
  summary: string;
  bullets: string[];
  caution: string;
};

type OpenAIClientLike = {
  chat: {
    completions: {
      create: (
        params: {
          model: string;
          messages: Array<{ role: "system" | "user"; content: string }>;
          max_tokens: number;
          response_format: { type: "json_object" };
        },
      ) => Promise<{
        choices?: Array<{
          finish_reason?: string | null;
          message?: {
            content?: string | null;
          } | null;
        }>;
      }>;
    };
  };
};

const SYSTEM_PROMPT = `You are an AI medical triage assistant.

Your job is to:
- analyze patient symptoms
- detect risk categories
- estimate severity

Return ONLY JSON.

Allowed risk flags:
- airway_issue
- breathing_issue
- circulation_issue
- neurological_risk
- external_bleeding
- internal_bleeding
- trauma
- cardiac_risk
- infection_risk
- shock_risk

Rules:
- Be conservative (prefer higher risk)
- Do NOT hallucinate unknown flags
- Output valid JSON only

JSON format:

{
  "risk_flags": ["..."],
  "critical_risk_confidence": 0-100,
  "summary": "...",
  "normalized_symptoms": ["..."]
}`;

const PATIENT_GUIDANCE_SYSTEM_PROMPT = `You are an emergency-room clinical support assistant.

You are helping a doctor or nurse review one patient at a time.

Rules:
- Use only the provided patient JSON
- Do NOT invent missing facts
- Do NOT claim certainty if the data is incomplete
- Do NOT replace doctor judgment
- Keep advice practical, concise, and bedside-oriented
- Mention escalation risk when appropriate
- Return ONLY JSON

JSON format:
{
  "heading": "...",
  "summary": "...",
  "bullets": ["...", "..."],
  "caution": "..."
}`;

const GUIDANCE_FALLBACK_SUMMARY =
  "AI clinical guidance is unavailable right now. Use triage factors, vitals, and bedside assessment.";

const GUIDANCE_INTENT_COPY: Record<
  PatientGuidancePromptKey,
  { heading: string; instruction: string }
> = {
  [PatientGuidancePromptKey.PredictedProblem]: {
    heading: "Likely Problem",
    instruction:
      "Identify the most likely clinical problem or syndrome suggested by the patient data. Focus on expected problem framing, not final diagnosis.",
  },
  [PatientGuidancePromptKey.CarePriorities]: {
    heading: "Immediate Priorities",
    instruction:
      "List the most important immediate care priorities and stabilization actions for this patient in the ER setting.",
  },
  [PatientGuidancePromptKey.DosAndDonts]: {
    heading: "Do's and Don'ts",
    instruction:
      "Give bedside do's and don'ts for this patient condition. Include both helpful actions and actions to avoid.",
  },
  [PatientGuidancePromptKey.MonitoringFocus]: {
    heading: "Monitoring Focus",
    instruction:
      "Explain what staff should watch closely over the next period, including deterioration signs and key vitals or symptoms to monitor.",
  },
  [PatientGuidancePromptKey.HandoffSummary]: {
    heading: "Handoff Summary",
    instruction:
      "Write a concise nurse/doctor handoff style summary describing likely issue, current risk, and what the next clinician should know.",
  },
};

const isGroqKey = (value: string | undefined) => Boolean(value?.startsWith("gsk_"));

export const getProvider = (): LlmProvider => {
  if (env.GROQ_API_KEY) {
    return "groq";
  }

  if (isGroqKey(env.XAI_API_KEY)) {
    return "groq";
  }

  return "xai";
};

export const getApiKey = () => {
  if (getProvider() === "groq") {
    return env.GROQ_API_KEY || env.XAI_API_KEY;
  }

  return env.XAI_API_KEY;
};

export const getBaseUrl = () => (getProvider() === "groq" ? env.GROQ_BASE_URL : env.XAI_BASE_URL);

export const getModel = () =>
  getProvider() === "groq"
    ? env.GROQ_MODEL || DEFAULT_GROQ_MODEL
    : env.XAI_MODEL || DEFAULT_XAI_MODEL;

export const createClient = () =>
  new OpenAI({
    apiKey: getApiKey(),
    baseURL: getBaseUrl(),
    timeout: env.AI_REQUEST_TIMEOUT_SECONDS * 1000,
    maxRetries: 1,
  });

const createFallbackResult = (status: LlmStatus.Fallback | LlmStatus.Failed): LLMAnalysisResult => ({
  status,
  risk_flags: [],
  critical_risk_confidence: 0,
  summary: FALLBACK_SUMMARY,
  normalized_symptoms: [],
});

const createGuidanceFallback = (
  promptKey: PatientGuidancePromptKey,
  status: LlmStatus.Fallback | LlmStatus.Failed,
): PatientGuidanceResult => ({
  status,
  heading: GUIDANCE_INTENT_COPY[promptKey].heading,
  summary: GUIDANCE_FALLBACK_SUMMARY,
  bullets: [
    "Review current vitals and risk factors directly from the patient record.",
    "Use bedside assessment and escalation protocols for final clinical decisions.",
  ],
  caution: "AI support unavailable. Do not rely on this response as a diagnosis.",
});

const isValidRiskFlags = (riskFlags: unknown): riskFlags is RiskFlag[] =>
  Array.isArray(riskFlags) &&
  riskFlags.every((flag) => typeof flag === "string" && ALLOWED_RISK_FLAGS.has(flag as RiskFlag));

const isValidNormalizedSymptoms = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const validateLLMOutput = (payload: unknown): payload is Omit<LLMAnalysisResult, "status"> => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const data = payload as {
    risk_flags?: unknown;
    critical_risk_confidence?: unknown;
    summary?: unknown;
    normalized_symptoms?: unknown;
  };

  return (
    isValidRiskFlags(data.risk_flags) &&
    typeof data.critical_risk_confidence === "number" &&
    data.critical_risk_confidence >= 0 &&
    data.critical_risk_confidence <= 100 &&
    typeof data.summary === "string" &&
    data.summary.trim().length > 0 &&
    isValidNormalizedSymptoms(data.normalized_symptoms)
  );
};

const validateGuidanceOutput = (
  payload: unknown,
): payload is Omit<PatientGuidanceResult, "status"> => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const data = payload as {
    heading?: unknown;
    summary?: unknown;
    bullets?: unknown;
    caution?: unknown;
  };

  return (
    typeof data.heading === "string" &&
    data.heading.trim().length > 0 &&
    typeof data.summary === "string" &&
    data.summary.trim().length > 0 &&
    Array.isArray(data.bullets) &&
    data.bullets.length > 0 &&
    data.bullets.every((entry) => typeof entry === "string" && entry.trim().length > 0) &&
    typeof data.caution === "string" &&
    data.caution.trim().length > 0
  );
};

const buildUserPrompt = ({ symptoms, vitals, injury, history }: LLMAnalysisInput) =>
  `Analyze this ER patient triage input and return JSON only.

symptoms:
${symptoms}

vitals:
${JSON.stringify(vitals, null, 2)}

injury:
${JSON.stringify(injury, null, 2)}

history:
${JSON.stringify(history, null, 2)}`;

const buildPatientGuidancePrompt = ({ promptKey, patient }: PatientGuidanceInput) =>
  `Return JSON only for this clinician request.

request_type:
${promptKey}

request_intent:
${GUIDANCE_INTENT_COPY[promptKey].instruction}

patient_json:
${JSON.stringify(patient, null, 2)}`;

export const createLLMAnalysis = async (
  input: LLMAnalysisInput,
  client: OpenAIClientLike = createClient(),
): Promise<LLMAnalysisResult> => {
  try {
    const response = await client.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildUserPrompt(input),
        },
      ],
      max_tokens: env.AI_MAX_TOKENS,
      response_format: { type: "json_object" },
    });

    const firstChoice = response.choices?.[0];
    const content = firstChoice?.message?.content;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return createFallbackResult(LlmStatus.Fallback);
    }

    if (firstChoice?.finish_reason === "length") {
      return createFallbackResult(LlmStatus.Fallback);
    }

    let parsedContent: unknown;

    try {
      parsedContent = JSON.parse(content);
    } catch {
      return createFallbackResult(LlmStatus.Failed);
    }

    if (!validateLLMOutput(parsedContent)) {
      return createFallbackResult(LlmStatus.Failed);
    }

    return {
      status: LlmStatus.Success,
      risk_flags: parsedContent.risk_flags,
      critical_risk_confidence: parsedContent.critical_risk_confidence,
      summary: parsedContent.summary,
      normalized_symptoms: parsedContent.normalized_symptoms,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
      return createFallbackResult(LlmStatus.Fallback);
    }

    return createFallbackResult(LlmStatus.Failed);
  }
};

export const createPatientGuidance = async (
  input: PatientGuidanceInput,
  client: OpenAIClientLike = createClient(),
): Promise<PatientGuidanceResult> => {
  try {
    const response = await client.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: "system",
          content: PATIENT_GUIDANCE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildPatientGuidancePrompt(input),
        },
      ],
      max_tokens: env.AI_MAX_TOKENS,
      response_format: { type: "json_object" },
    });

    const firstChoice = response.choices?.[0];
    const content = firstChoice?.message?.content;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return createGuidanceFallback(input.promptKey, LlmStatus.Fallback);
    }

    if (firstChoice?.finish_reason === "length") {
      return createGuidanceFallback(input.promptKey, LlmStatus.Fallback);
    }

    let parsedContent: unknown;

    try {
      parsedContent = JSON.parse(content);
    } catch {
      return createGuidanceFallback(input.promptKey, LlmStatus.Failed);
    }

    if (!validateGuidanceOutput(parsedContent)) {
      return createGuidanceFallback(input.promptKey, LlmStatus.Failed);
    }

    return {
      status: LlmStatus.Success,
      heading: parsedContent.heading,
      summary: parsedContent.summary,
      bullets: parsedContent.bullets.slice(0, 6),
      caution: parsedContent.caution,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
      return createGuidanceFallback(input.promptKey, LlmStatus.Fallback);
    }

    return createGuidanceFallback(input.promptKey, LlmStatus.Failed);
  }
};
