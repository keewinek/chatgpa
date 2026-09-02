import { Hono } from "hono";
import { listPublicModels, runChat, runChatStream } from "./ai/mod.ts";
import type { ChatRequestBody } from "./ai/mod.ts";
import { checkDatabaseHealth, getDb } from "./db/client.ts";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  normalizeMimeType,
  sanitizeFilename,
} from "./files/mime.ts";
import { getFile, putFile, toAttachment } from "./files/store.ts";
import { createFsRoutes } from "./fs/routes.ts";
import { createMemoryRoutes } from "./memory/routes.ts";
import { createSyncRoutes } from "./sync/routes.ts";
import { createNotesRoutes } from "./notes/routes.ts";
import { createTodoRoutes } from "./todo/routes.ts";
import { createCalendarRoutes } from "./calendar/routes.ts";
import { createProfileRoutes } from "./profile/routes.ts";
import { createLibrusRoutes } from "./librus/routes.ts";
import { createPlanRoutes } from "./plan/routes.ts";
import { createNotificationRoutes } from "./notifications/routes.ts";
import { createThreadRoutes } from "./threads/routes.ts";
import { createMigrateRoutes } from "./migrate/routes.ts";
import { isChatMessage, sanitizeGroupPrefs, sanitizeMemory } from "./validate.ts";

export function createApp() {
  const app = new Hono();

  app.get("/api/health", async (c) => {
    const db = await checkDatabaseHealth();
    const status = db === "error" ? "degraded" : "ok";
    return c.json({ status, db }, db === "error" ? 503 : 200);
  });
  app.get("/api/ai/models", (c) => c.json({ models: listPublicModels() }));

  app.route("/api/sync", createSyncRoutes(getDb));
  app.route("/api/fs", createFsRoutes(getDb));
  app.route("/api/memory", createMemoryRoutes(getDb));
  app.route("/api/todos", createTodoRoutes(getDb));
  app.route("/api/notes", createNotesRoutes(getDb));
  app.route("/api/calendar", createCalendarRoutes(getDb));
  app.route("/api/profile", createProfileRoutes(getDb));
  app.route("/api/librus", createLibrusRoutes(getDb));
  app.route("/api/plan", createPlanRoutes(getDb));
  app.route("/api/notifications", createNotificationRoutes(getDb));
  app.route("/api/threads", createThreadRoutes(getDb));
  app.route("/api/migrate", createMigrateRoutes(getDb));

  app.post("/api/upload", async (c) => {
    const body = await c.req.parseBody({ all: true }).catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowe dane formularza" }, 400);

    const raw = body.file ?? body.files;
    const file = Array.isArray(raw) ? raw[0] : raw;
    if (!(file instanceof File)) return c.json({ error: "Pole file jest wymagane" }, 400);
    if (file.size > MAX_FILE_BYTES) {
      return c.json({ error: `Plik jest za duży (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)` }, 400);
    }

    const mimeType = normalizeMimeType(file.type, file.name);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return c.json({ error: "Nieobsługiwany typ pliku" }, 400);
    }

    try {
      const stored = await putFile({
        name: sanitizeFilename(file.name),
        mimeType,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      return c.json({ ...toAttachment(stored), url: `/api/files/${stored.id}` });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
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

  app.post("/api/chat/stream", async (c) => {
    const body = await c.req.json<ChatRequestBody>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);
    if (!Array.isArray(body.messages) || !body.messages.length) {
      return c.json({ error: "Pole messages jest wymagane" }, 400);
    }
    if (!body.messages.every(isChatMessage)) {
      return c.json(
        { error: "Nieprawidłowe messages (najpierw POST /api/upload dla plików)" },
        400,
      );
    }

    const memory = sanitizeMemory(body.memory);
    const groupPrefs = sanitizeGroupPrefs(body.groupPrefs);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        try {
          for await (
            const event of runChatStream(body.messages, {
              forceModel: body.model,
              memory,
              groupPrefs,
            })
          ) {
            send(event);
          }
        } catch (err) {
          send({
            type: "error",
            error: err instanceof Error ? err.message : String(err),
            attempts: [],
            memory,
          });
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });

  app.post("/api/chat", async (c) => {
    const body = await c.req.json<ChatRequestBody>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);
    if (!Array.isArray(body.messages) || !body.messages.length) {
      return c.json({ error: "Pole messages jest wymagane" }, 400);
    }
    if (!body.messages.every(isChatMessage)) {
      return c.json(
        { error: "Nieprawidłowe messages (najpierw POST /api/upload dla plików)" },
        400,
      );
    }

    const result = await runChat(body.messages, {
      forceModel: body.model,
      memory: sanitizeMemory(body.memory),
      groupPrefs: sanitizeGroupPrefs(body.groupPrefs),
    });

    if (!result.ok) {
      return c.json({ error: result.error, attempts: result.attempts, memory: result.memory }, 503);
    }

    const attachments = result.attachments.length ? result.attachments : undefined;
    return c.json({
      message: { role: "assistant", content: result.content, attachments },
      model: result.model,
      provider: result.provider,
      attempts: result.attempts,
      memory: result.memory,
      toolResults: result.toolResults,
      attachments,
    });
  });

  return app;
}
