import { Hono } from "hono";
import { listPublicModels, runChat } from "./ai/mod.ts";
import type { ChatAttachment, ChatMessage, ChatRequestBody } from "./ai/mod.ts";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  normalizeMimeType,
  sanitizeFilename,
} from "./files/mime.ts";
import { getFile, putFile, toAttachment } from "./files/store.ts";

function isAttachment(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    a.id.length > 0 &&
    typeof a.name === "string" &&
    typeof a.mimeType === "string"
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  const roleOk = m.role === "system" || m.role === "user" || m.role === "assistant";
  const content = m.content;
  const contentOk = typeof content === "string";
  const attachments = m.attachments;
  const hasAttachments = Array.isArray(attachments) &&
    attachments.length > 0 &&
    attachments.every(isAttachment) &&
    attachments.every((a) => getFile(a.id) !== undefined);
  return roleOk && contentOk && (content.trim().length > 0 || hasAttachments);
}

function sanitizeMemory(memory: unknown): string[] {
  if (!Array.isArray(memory)) return [];
  return memory
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 100);
}

export function createApp() {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.get("/api/ai/models", (c) => {
    return c.json({ models: listPublicModels() });
  });

  app.post("/api/upload", async (c) => {
    let body: Record<string, FormDataEntryValue>;
    try {
      body = await c.req.parseBody({ all: true });
    } catch {
      return c.json({ error: "Nieprawidłowe dane formularza" }, 400);
    }

    const raw = body.file ?? body.files;
    const file = Array.isArray(raw) ? raw[0] : raw;
    if (!(file instanceof File)) {
      return c.json({ error: "Pole file jest wymagane" }, 400);
    }

    if (file.size > MAX_FILE_BYTES) {
      return c.json({
        error: `Plik jest za duży (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)`,
      }, 400);
    }

    const mimeType = normalizeMimeType(file.type, file.name);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return c.json({ error: "Nieobsługiwany typ pliku" }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      const stored = putFile({
        name: sanitizeFilename(file.name),
        mimeType,
        bytes,
      });
      const attachment = toAttachment(stored);
      return c.json({
        ...attachment,
        url: `/api/files/${stored.id}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 400);
    }
  });

  app.get("/api/files/:id", (c) => {
    const file = getFile(c.req.param("id"));
    if (!file) return c.notFound();

    return new Response(file.bytes as Uint8Array<ArrayBuffer>, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });

  app.post("/api/chat", async (c) => {
    let body: ChatRequestBody;
    try {
      body = await c.req.json<ChatRequestBody>();
    } catch {
      return c.json({ error: "Nieprawidłowy JSON" }, 400);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: "Pole messages jest wymagane" }, 400);
    }

    if (!body.messages.every(isChatMessage)) {
      return c.json({
        error:
          "Każda wiadomość musi mieć role, content lub istniejące attachments (najpierw POST /api/upload)",
      }, 400);
    }

    const memory = sanitizeMemory(body.memory);
    const result = await runChat(body.messages, { forceModel: body.model, memory });

    if (!result.ok) {
      return c.json({
        error: result.error,
        attempts: result.attempts,
        memory: result.memory,
      }, 503);
    }

    return c.json({
      message: {
        role: "assistant" as const,
        content: result.content,
        attachments: result.attachments.length > 0 ? result.attachments : undefined,
      },
      model: result.model,
      provider: result.provider,
      attempts: result.attempts,
      memory: result.memory,
      toolResults: result.toolResults,
      attachments: result.attachments.length > 0 ? result.attachments : undefined,
    });
  });

  return app;
}
