/** Shared chat / AI types for the API layer. */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AiAttempt {
  provider: string;
  model: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

export interface AiSuccess {
  content: string;
  provider: string;
  model: string;
  attempts: AiAttempt[];
}

export interface AiFailure {
  error: string;
  attempts: AiAttempt[];
}

export type AiResult =
  | ({ ok: true } & AiSuccess)
  | ({ ok: false } & AiFailure);

export interface ModelSlot {
  /** Human-readable provider id, e.g. "gemini" | "groq" | "openrouter" */
  provider: string;
  /** Model id sent to the provider API */
  model: string;
  /** Env var that must be set for this slot to be active */
  apiKeyEnv: string;
  /** Higher = smarter / preferred earlier in the cascade */
  priority: number;
  /** Short label shown in UI */
  label: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  /** Optional override — force a single model id */
  model?: string;
}
