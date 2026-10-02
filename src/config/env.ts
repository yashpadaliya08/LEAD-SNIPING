import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required in .env"),
  TELEGRAM_CHAT_ID: z.string().min(1, "TELEGRAM_CHAT_ID is required in .env"),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  POLL_INTERVAL_MS: z.coerce.number().default(45000),
  MAX_ALERTS_PER_HOUR: z.coerce.number().default(10),
  MAX_LEAD_AGE_HOURS: z.coerce.number().default(24),
  MIN_HOURLY_RATE: z.coerce.number().default(30),
  MIN_FIXED_BUDGET: z.coerce.number().default(200),
  FREELANCER_NAME: z.string().default("Partner"),
  FREELANCER_TITLE: z.string().default("Rapid MVP & Automation Engineer"),
  FREELANCER_CORE_SKILLS: z
    .string()
    .default("Next.js, React, Node.js, Python, Web Scraping, AI Automation, APIs, Supabase"),
  PROMPT_CACHING_ENABLED: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Environment configuration validation failed:", error.errors);
  }
  process.exit(1);
}

export const config = parsedEnv;
