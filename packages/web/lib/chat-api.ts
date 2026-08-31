import type { ChatAttachment } from "@chatgpa/core";
import type { StoredMessage } from "./chat-storage.ts";

const API = "";

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

export async function postChat(messages: StoredMessage[], memory: string[]) {
  const res = await fetch(`${API}/api/chat`, {
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
  const data = await res.json().catch(() => ({ error: "Nieprawidłowa odpowiedź API" }));
  return { ok: res.ok, data };
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
