import type { ChatAttachment, ChatMessage, GroupPrefs } from "@chatgpa/core";
import { DEFAULT_GROUP_PREFS } from "@chatgpa/core";

export function sanitizeMemory(memory: unknown): string[] {
  if (!Array.isArray(memory)) return [];
  return memory
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
}

export function sanitizeGroupPrefs(prefs: unknown): GroupPrefs {
  if (!prefs || typeof prefs !== "object") return { ...DEFAULT_GROUP_PREFS };
  const p = prefs as Record<string, unknown>;
  const pick = (v: unknown): 1 | 2 => (v === 2 ? 2 : 1);
  return {
    language: pick(p.language),
    english: pick(p.english),
    pe: pick(p.pe),
    informatics: pick(p.informatics),
  };
}

function isAttachment(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return typeof a.id === "string" && typeof a.name === "string" && typeof a.mimeType === "string";
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  const role = m.role;
  if (role !== "system" && role !== "user" && role !== "assistant") return false;
  const content = typeof m.content === "string" ? m.content : "";
  const attachments = m.attachments;
  const hasFiles = Array.isArray(attachments) && attachments.length > 0 &&
    attachments.every(isAttachment);
  return content.trim().length > 0 || hasFiles;
}
