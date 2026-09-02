/** MIME types accepted for upload and AI vision. */
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function isVisionMime(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export function isTextMime(mimeType: string): boolean {
  return mimeType === "text/plain" || mimeType === "text/markdown";
}

export function normalizeMimeType(mimeType: string, name: string): string {
  const trimmed = mimeType.trim().toLowerCase();
  if (trimmed && ALLOWED_MIME_TYPES.has(trimmed)) return trimmed;

  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return trimmed || "application/octet-stream";
}

export function sanitizeFilename(name: string): string {
  // deno-lint-ignore no-control-regex
  const base = name.replace(/[/\\<>:"|?*\x00-\x1f]/g, "_").trim();
  return base.length > 0 ? base.slice(0, 180) : "plik";
}
