import { Hono } from "hono";
import { listPublicModels, runChat } from "./ai/mod.ts";
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
      },
      model: result.model,
      provider: result.provider,
      attempts: result.attempts,
      memory: result.memory,
      toolResults: result.toolResults,
    });
  });

  return app;
}
