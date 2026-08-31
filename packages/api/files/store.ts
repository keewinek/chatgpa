import type { ChatAttachment } from "@chatgpa/core";
import { extractDocxText } from "./docx.ts";
import {
  ALLOWED_MIME_TYPES,
  isTextMime,
  isVisionMime,
  MAX_FILE_BYTES,
  normalizeMimeType,
  sanitizeFilename,
} from "./mime.ts";

export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  createdAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const files = new Map<string, StoredFile>();

function fileId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, file] of files) {
    if (now - file.createdAt > TTL_MS) files.delete(id);
  }
}

export function toAttachment(file: StoredFile): ChatAttachment {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.bytes.byteLength,
  };
}

export function putFile(input: {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}): StoredFile {
  pruneExpired();

  if (input.bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`Plik jest za duży (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)`);
  }

  const mimeType = normalizeMimeType(input.mimeType, input.name);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Nieobsługiwany typ pliku");
  }

  const file: StoredFile = {
    id: fileId(),
    name: sanitizeFilename(input.name),
    mimeType,
    bytes: input.bytes,
    createdAt: Date.now(),
  };
  files.set(file.id, file);
  return file;
}

export function getFile(id: string): StoredFile | undefined {
  pruneExpired();
  return files.get(id);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Text extracted from docx or plain text files for non-vision models. */
export async function attachmentTextSnippet(file: StoredFile, max = 8000): Promise<string> {
  if (isTextMime(file.mimeType)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes).trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }
  if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const text = await extractDocxText(file.bytes);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }
  return "";
}

export function messagesNeedVision(
  messages: Array<{ attachments?: ChatAttachment[] }>,
): boolean {
  for (const message of messages) {
    for (const att of message.attachments ?? []) {
      const file = getFile(att.id);
      if (file && isVisionMime(file.mimeType)) return true;
    }
  }
  return false;
}

export function describeAttachment(file: StoredFile): string {
  if (isVisionMime(file.mimeType)) {
    return `[plik: ${file.name} (${file.mimeType})]`;
  }
  return `[plik: ${file.name}]`;
}
