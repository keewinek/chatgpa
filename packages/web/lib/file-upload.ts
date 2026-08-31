import type { ChatAttachment } from "@chatgpa/core";

const API_BASE = "";

export interface PendingFile {
  localId: string;
  file: File;
  previewUrl?: string;
}

export async function uploadFile(file: File): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Upload nieudany");
  }

  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    size: data.size,
  };
}

export function createPendingFile(file: File): PendingFile {
  const pending: PendingFile = {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
  };
  if (file.type.startsWith("image/")) {
    pending.previewUrl = URL.createObjectURL(file);
  }
  return pending;
}

export function releasePendingFile(pending: PendingFile) {
  if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
}

export const ACCEPTED_FILE_TYPES =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,.docx";
