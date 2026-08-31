import type { ModelSlot } from "./types.ts";

/** Smartest free models first; missing API keys are skipped at runtime. */
export const MODEL_CASCADE: ModelSlot[] = [
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 100,
    label: "Gemini 2.5 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 90,
    label: "Gemini 2.0 Flash",
  },
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 80,
    label: "Llama 3.3 70B (Groq)",
  },
  {
    provider: "openrouter",
    model: "deepseek/deepseek-r1:free",
    apiKeyEnv: "OPENROUTER_API_KEY",
    priority: 70,
    label: "DeepSeek R1 (OpenRouter free)",
  },
  {
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    apiKeyEnv: "OPENROUTER_API_KEY",
    priority: 60,
    label: "Llama 3.3 70B (OpenRouter free)",
  },
  {
    provider: "groq",
    model: "llama-3.1-8b-instant",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 40,
    label: "Llama 3.1 8B (Groq)",
  },
  {
    provider: "gemini",
    model: "gemini-2.0-flash-lite",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 30,
    label: "Gemini 2.0 Flash-Lite",
  },
];
