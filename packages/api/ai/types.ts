import type { ChatMessage, ChatRole } from "@chatgpa/core";

export type { ChatMessage, ChatRole };

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
  provider: string;
  model: string;
  apiKeyEnv: string;
  priority: number;
  label: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
}
