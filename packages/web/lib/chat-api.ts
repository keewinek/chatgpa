import type { ChatAttachment } from "@chatgpa/core";
import type { StoredMessage } from "./chat-storage.ts";

const API = "";

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "tool"; results: Array<{ tool: string; ok: boolean; output?: string; error?: string }> }
  | {
    type: "done";
    content: string;
    model: string;
    provider: string;
    attempts: unknown[];
    memory: string[];
    toolResults: Array<{ tool: string; ok: boolean; output?: string; error?: string }>;
    attachments?: ChatAttachment[];
  }
  | { type: "error"; error: string; attempts: unknown[]; memory: string[] };

export async function fetchModels() {
  const res = await fetch(`${API}/api/ai/models`);
  return res.json() as Promise<{ models: Array<{ configured: boolean; label: string }> }>;
}

export async function uploadFile(file: File): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/api/upload`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Upload nieudany");
  return { id: data.id, name: data.name, mimeType: data.mimeType, size: data.size };
}

export async function streamChat(
  messages: StoredMessage[],
  memory: string[],
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const res = await fetch(`${API}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      })),
      memory,
    }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: "Streaming nieudany" }));
    onEvent({
      type: "error",
      error: typeof data.error === "string" ? data.error : "Streaming nieudany",
      attempts: data.attempts ?? [],
      memory: Array.isArray(data.memory) ? data.memory : memory,
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd: number;
    while ((lineEnd = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as ChatStreamEvent);
      } catch {
        // skip malformed events
      }
    }
  }
}

export const ACCEPTED_FILES =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,.docx";

export interface PendingFile {
  id: string;
  file: File;
  preview?: string;
}

export function pendingFrom(file: File): PendingFile {
  const pending: PendingFile = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
  };
  if (file.type.startsWith("image/")) pending.preview = URL.createObjectURL(file);
  return pending;
}

export function releasePending(pending: PendingFile) {
  if (pending.preview) URL.revokeObjectURL(pending.preview);
}
