import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Subject } from "@chatgpa/core";
import { listPublicModels, runCascade } from "./ai/mod.ts";
import type { ChatMessage, ChatRequestBody } from "./ai/mod.ts";

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "system" || m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.trim().length > 0
  );
}

export function createApp() {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ],
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/api/subjects", (c) => {
    const subjects: Subject[] = [];
    return c.json(subjects);
  });

  app.get("/api/ai/models", (c) => {
    return c.json({ models: listPublicModels() });
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
        error: "Każda wiadomość musi mieć role (system|user|assistant) i content",
      }, 400);
    }

    const result = await runCascade(body.messages, body.model);

    if (!result.ok) {
      return c.json({
        error: result.error,
        attempts: result.attempts,
      }, 503);
    }

    return c.json({
      message: {
        role: "assistant" as const,
        content: result.content,
      },
      model: result.model,
      provider: result.provider,
      attempts: result.attempts,
    });
  });

  return app;
}
