import type { ChatAttachment, ChatMessage, ChatRole, GroupPrefs, MemoryEntry } from "@chatgpa/core";

export type { ChatAttachment, ChatMessage, ChatRole };

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

export interface ToolResultPublic {
  tool: string;
  ok: boolean;
  output?: string;
  error?: string;
  attachment?: ChatAttachment;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
  /** Legacy facts from localStorage — migrated to long-term on server when DB is available. */
  memory?: string[];
  /** Student's lesson group preferences for timetable filtering. */
  groupPrefs?: GroupPrefs;
}

export interface ChatResponseBody {
  message: { role: "assistant"; content: string; attachments?: ChatAttachment[] };
  model: string;
  provider: string;
  attempts: AiAttempt[];
  memory: MemoryEntry[];
  toolResults: ToolResultPublic[];
  attachments?: ChatAttachment[];
}
