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
const memory = new Map<string, StoredFile>();
let kv: Deno.Kv | null = null;
let kvReady: Promise<Deno.Kv | null> | null = null;

function fileId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function openKv(): Promise<Deno.Kv | null> {
  if (kv) return kv;
  if (!kvReady) {
    kvReady = (async () => {
      try {
        if (typeof Deno.openKv !== "function") return null;
        kv = await Deno.openKv();
        return kv;
      } catch {
        return null;
      }
    })();
  }
  return await kvReady;
}

function pruneExpired() {
  const now = Date.now();
  for (const [id, file] of memory) {
    if (now - file.createdAt > TTL_MS) memory.delete(id);
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

export async function putFile(input: {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<StoredFile> {
  pruneExpired();

  if (input.bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`Plik jest za duży (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)`);
  }

  const mimeType = normalizeMimeType(input.mimeType, input.name);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error("Nieobsługiwany typ pliku");

  const file: StoredFile = {
    id: fileId(),
    name: sanitizeFilename(input.name),
    mimeType,
    bytes: input.bytes,
    createdAt: Date.now(),
  };

  memory.set(file.id, file);

  const store = await openKv();
  if (store) {
    await store.set(
      ["file", file.id],
      { name: file.name, mimeType: file.mimeType, bytes: file.bytes, createdAt: file.createdAt },
      { expireIn: TTL_MS },
    );
  }

  return file;
}

/** Sync read from local memory (same request / isolate). */
export function getFile(id: string): StoredFile | undefined {
  pruneExpired();
  return memory.get(id);
}

/** Load from memory or Deno KV (production multi-isolate). */
export async function ensureFile(id: string): Promise<StoredFile | undefined> {
  const cached = getFile(id);
  if (cached) return cached;

  const store = await openKv();
  if (!store) return undefined;

  const entry = await store.get<{
    name: string;
    mimeType: string;
    bytes: Uint8Array;
    createdAt: number;
  }>(["file", id]);

  if (!entry.value) return undefined;

  const file: StoredFile = { id, ...entry.value };
  memory.set(id, file);
  return file;
}

export async function hydrateMessageFiles(
  messages: Array<{ attachments?: ChatAttachment[] }>,
): Promise<void> {
  for (const message of messages) {
    for (const att of message.attachments ?? []) await ensureFile(att.id);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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

export async function messagesNeedVision(
  messages: Array<{ attachments?: ChatAttachment[] }>,
): Promise<boolean> {
  for (const message of messages) {
    for (const att of message.attachments ?? []) {
      const file = await ensureFile(att.id);
      if (file && isVisionMime(file.mimeType)) return true;
    }
  }
  return false;
}

export function describeAttachment(file: StoredFile): string {
  return isVisionMime(file.mimeType)
    ? `[plik: ${file.name} (${file.mimeType})]`
    : `[plik: ${file.name}]`;
}
