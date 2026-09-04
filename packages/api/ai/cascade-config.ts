import type { ModelSlot } from "./types.ts";

/**
 * Smart→dumb cascade: try the strongest free models first, fall back to weaker/faster ones.
 * Dead IDs (404) are omitted. Cooldown in cascade.ts skips hot 429/404 failures.
 */
export const MODEL_CASCADE: ModelSlot[] = [
  {
    provider: "gemini",
    model: "gemini-3.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 100,
    label: "Gemini 3.5 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-3-flash-preview",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 95,
    label: "Gemini 3 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-flash-latest",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 90,
    label: "Gemini Flash (latest)",
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 85,
    label: "Gemini 2.5 Flash",
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 80,
    label: "GPT-OSS 120B (Groq)",
  },
  {
    provider: "zai",
    model: "glm-4.7-flash",
    apiKeyEnv: "ZAI_API_KEY",
    priority: 70,
    label: "GLM 4.7 Flash (Z.AI)",
  },
  {
    provider: "mistral",
    model: "mistral-small-latest",
    apiKeyEnv: "MISTRAL_API_KEY",
    priority: 65,
    label: "Mistral Small",
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 60,
    label: "GPT-OSS 20B (Groq)",
  },
  {
    provider: "zai",
    model: "glm-4.5-flash",
    apiKeyEnv: "ZAI_API_KEY",
    priority: 55,
    label: "GLM 4.5 Flash (Z.AI)",
  },
  {
    provider: "mistral",
    model: "open-mistral-nemo",
    apiKeyEnv: "MISTRAL_API_KEY",
    priority: 50,
    label: "Mistral Nemo 12B",
  },
];
