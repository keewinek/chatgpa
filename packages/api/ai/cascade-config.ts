import type { ModelSlot } from "./types.ts";

/**
 * Fast-first cascade: Groq is typically <500ms; Gemini free-tier often 429s first.
 * Dead IDs (404) are omitted. Cooldown in cascade.ts further skips hot failures.
 */
export const MODEL_CASCADE: ModelSlot[] = [
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 100,
    label: "GPT-OSS 120B (Groq)",
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-20b",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 95,
    label: "GPT-OSS 20B (Groq)",
  },
  {
    provider: "gemini",
    model: "gemini-3-flash-preview",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 90,
    label: "Gemini 3 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-3.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 85,
    label: "Gemini 3.5 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-flash-latest",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 80,
    label: "Gemini Flash (latest)",
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 75,
    label: "Gemini 2.5 Flash",
  },
  {
    provider: "zai",
    model: "glm-4.7-flash",
    apiKeyEnv: "ZAI_API_KEY",
    priority: 68,
    label: "GLM 4.7 Flash (Z.AI)",
  },
  {
    provider: "zai",
    model: "glm-4.5-flash",
    apiKeyEnv: "ZAI_API_KEY",
    priority: 65,
    label: "GLM 4.5 Flash (Z.AI)",
  },
  {
    provider: "mistral",
    model: "mistral-small-latest",
    apiKeyEnv: "MISTRAL_API_KEY",
    priority: 58,
    label: "Mistral Small",
  },
  {
    provider: "mistral",
    model: "open-mistral-nemo",
    apiKeyEnv: "MISTRAL_API_KEY",
    priority: 55,
    label: "Mistral Nemo 12B",
  },
];
