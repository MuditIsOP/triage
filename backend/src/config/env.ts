import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env"), override: false });

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive({
      message: "PORT must be a positive integer",
    }),
    MONGO_URI: z.string().min(1, "MONGO_URI is required"),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    JWT_EXPIRES_IN: z.string().default("8h"),
    XAI_API_KEY: z.string().optional().default(""),
    XAI_BASE_URL: z.string().url().default("https://api.x.ai/v1"),
    XAI_MODEL: z.string().default("grok-3"),
    GROQ_API_KEY: z.string().optional().default(""),
    GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
    GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
    AI_REQUEST_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
    AI_MAX_TOKENS: z.coerce.number().int().positive().default(500),
    DEFAULT_GENERAL_BEDS: z.coerce.number().int().positive().default(12),
    DEFAULT_CRITICAL_BEDS: z.coerce.number().int().positive().default(6),
    SIMULATION_ENABLED: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    SIMULATION_TICK_SECONDS: z.coerce.number().int().positive().default(30),
    SEED_ENABLED: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
  })
  .superRefine((value, context) => {
    if (!value.XAI_API_KEY && !value.GROQ_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either XAI_API_KEY or GROQ_API_KEY is required",
        path: ["XAI_API_KEY"],
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
