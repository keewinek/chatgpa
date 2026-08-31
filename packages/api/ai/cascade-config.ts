import type { ModelSlot } from "./types.ts";

/** Smartest first. Multiple Gemini fallbacks — Groq replacements for deprecated Llama IDs. */
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
    model: "gemini-2.5-flash-lite",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 95,
    label: "Gemini 2.5 Flash-Lite",
  },
  {
    provider: "gemini",
    model: "gemini-3.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 90,
    label: "Gemini 3.5 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-3-flash-preview",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 85,
    label: "Gemini 3 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-flash-latest",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 80,
    label: "Gemini Flash (latest)",
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 70,
    label: "GPT-OSS 120B (Groq)",
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 60,
    label: "GPT-OSS 20B (Groq)",
  },
];
