import { z } from "zod";
import { config as loadDotenv } from "dotenv";

// Load environment variables from .env file
loadDotenv();

const ConfigSchema = z.object({
  // LLM
  llmProvider: z.enum(["openai", "anthropic"]).default("openai"),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().default("gpt-4"),
  anthropicApiKey: z.string().optional(),
  anthropicModel: z.string().default("claude-3-5-sonnet-20241022"),

  // Database
  databaseUrl: z.string().optional(),

  // Search
  serperApiKey: z.string().optional(),
  braveApiKey: z.string().optional(),

  // Code execution
  enableCodeExecution: z.boolean().default(false),
  codeExecutionTimeout: z.number().default(30000),

  // Traces
  traceDir: z.string().default("./traces"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const config = ConfigSchema.parse({
    llmProvider: process.env.LLM_PROVIDER,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL,
    databaseUrl: process.env.DATABASE_URL,
    serperApiKey: process.env.SERPER_API_KEY,
    braveApiKey: process.env.BRAVE_API_KEY,
    enableCodeExecution: process.env.ENABLE_CODE_EXECUTION === "true",
    codeExecutionTimeout: process.env.CODE_EXECUTION_TIMEOUT
      ? parseInt(process.env.CODE_EXECUTION_TIMEOUT, 10)
      : undefined,
    traceDir: process.env.TRACE_DIR,
  });

  return config;
}

