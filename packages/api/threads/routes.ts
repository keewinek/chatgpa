import { Hono } from "hono";
import type { ChatAttachment } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import {
  createMessage,
  createThread,
  deleteMessage,
  deleteThread,
  getMessage,
  getThread,
  listMessages,
  listThreads,
  type ThreadMode,
  updateMessage,
  updateThread,
} from "./service.ts";

function parseMode(value: unknown): ThreadMode | undefined {
  if (value === "ask" || value === "plan" || value === "agent" || value === "focus") return value;
  return undefined;
}

function parseRole(value: unknown): "user" | "assistant" | null {
  if (value === "user" || value === "assistant") return value;
  return null;
}

function parseAttachments(value: unknown): ChatAttachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value as ChatAttachment[];
}

export function createThreadRoutes(getDatabase: () => AppDatabase | null) {
  const threads = new Hono();

  threads.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const includeMessages = c.req.query("include") === "messages";
    const list = await listThreads(db, { includeMessages });
    return c.json({ threads: list });
  });

  threads.post("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    const thread = await createThread(db, {
      id: typeof body.id === "string" ? body.id : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      mode: parseMode(body.mode),
      notificationContext: body.notificationContext as
        | { todoToday: unknown[]; freeMinutes: number }
        | undefined,
      createdAt: typeof body.createdAt === "number" || typeof body.createdAt === "string"
        ? body.createdAt
        : undefined,
      updatedAt: typeof body.updatedAt === "number" || typeof body.updatedAt === "string"
        ? body.updatedAt
        : undefined,
    });
    return c.json({ thread }, 201);
  });

  threads.get("/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const includeMessages = c.req.query("include") !== "false";
    const thread = await getThread(db, c.req.param("id"), { includeMessages });
    if (!thread) return c.json({ error: "Nie znaleziono wątku" }, 404);
    return c.json({ thread });
  });

  threads.patch("/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    const thread = await updateThread(db, c.req.param("id"), {
      title: typeof body.title === "string" ? body.title : undefined,
      mode: body.mode === null ? null : parseMode(body.mode),
      notificationContext: body.notificationContext === null
        ? null
        : body.notificationContext as { todoToday: unknown[]; freeMinutes: number } | undefined,
      updatedAt: typeof body.updatedAt === "number" || typeof body.updatedAt === "string"
        ? body.updatedAt
        : undefined,
    });
    if (!thread) return c.json({ error: "Nie znaleziono wątku" }, 404);
    return c.json({ thread });
  });

  threads.delete("/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const thread = await deleteThread(db, c.req.param("id"));
    if (!thread) return c.json({ error: "Nie znaleziono wątku" }, 404);
    return c.json({ thread });
  });

  threads.get("/:id/messages", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const thread = await getThread(db, c.req.param("id"), { includeMessages: false });
    if (!thread) return c.json({ error: "Nie znaleziono wątku" }, 404);

    const messages = await listMessages(db, c.req.param("id"));
    return c.json({ messages });
  });

  threads.post("/:id/messages", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    const role = parseRole(body?.role);
    if (!body || !role || typeof body.content !== "string") {
      return c.json({ error: "Pola role i content są wymagane" }, 400);
    }

    const message = await createMessage(db, c.req.param("id"), {
      id: typeof body.id === "string" ? body.id : undefined,
      role,
      content: body.content,
      model: typeof body.model === "string" ? body.model : undefined,
      provider: typeof body.provider === "string" ? body.provider : undefined,
      error: body.error === true,
      streaming: body.streaming === true,
      toolResults: Array.isArray(body.toolResults)
        ? body.toolResults as Array<{ tool: string; ok: boolean; output?: string; error?: string }>
        : undefined,
      attachments: parseAttachments(body.attachments),
      createdAt: typeof body.createdAt === "number" || typeof body.createdAt === "string"
        ? body.createdAt
        : undefined,
      updatedAt: typeof body.updatedAt === "number" || typeof body.updatedAt === "string"
        ? body.updatedAt
        : undefined,
    });
    if (!message) return c.json({ error: "Nie znaleziono wątku" }, 404);
    return c.json({ message }, 201);
  });

  threads.get("/:id/messages/:messageId", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const message = await getMessage(db, c.req.param("id"), c.req.param("messageId"));
    if (!message) return c.json({ error: "Nie znaleziono wiadomości" }, 404);
    return c.json({ message });
  });

  threads.patch("/:id/messages/:messageId", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    const message = await updateMessage(db, c.req.param("id"), c.req.param("messageId"), {
      content: typeof body.content === "string" ? body.content : undefined,
      model: body.model === null ? null : typeof body.model === "string" ? body.model : undefined,
      provider: body.provider === null
        ? null
        : typeof body.provider === "string"
        ? body.provider
        : undefined,
      error: body.error === null ? null : body.error === true ? true : undefined,
      streaming: body.streaming === null ? null : body.streaming === true ? true : undefined,
      toolResults: body.toolResults === null
        ? null
        : Array.isArray(body.toolResults)
        ? body.toolResults as Array<{ tool: string; ok: boolean; output?: string; error?: string }>
        : undefined,
      attachments: body.attachments === null ? null : parseAttachments(body.attachments),
      updatedAt: typeof body.updatedAt === "number" || typeof body.updatedAt === "string"
        ? body.updatedAt
        : undefined,
    });
    if (!message) return c.json({ error: "Nie znaleziono wiadomości" }, 404);
    return c.json({ message });
  });

  threads.delete("/:id/messages/:messageId", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const message = await deleteMessage(db, c.req.param("id"), c.req.param("messageId"));
    if (!message) return c.json({ error: "Nie znaleziono wiadomości" }, 404);
    return c.json({ message });
  });

  return threads;
}
