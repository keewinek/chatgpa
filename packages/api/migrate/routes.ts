import { Hono } from "hono";
import type { ChatAttachment } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { countThreads, migrateLocalStore } from "../threads/service.ts";

export function createMigrateRoutes(getDatabase: () => AppDatabase | null) {
  const migrate = new Hono();

  migrate.post("/local", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{
      store?: {
        activeSessionId?: string;
        sessions?: Array<{
          id: string;
          title: string;
          createdAt: number;
          updatedAt: number;
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            model?: string;
            provider?: string;
            error?: boolean;
            streaming?: boolean;
            toolResults?: Array<{ tool: string; ok: boolean; output?: string; error?: string }>;
            attachments?: ChatAttachment[];
          }>;
          notificationContext?: { todoToday: unknown[]; freeMinutes: number };
        }>;
      };
    }>().catch(() => null);

    if (!body?.store || !Array.isArray(body.store.sessions)) {
      return c.json({ error: "Pole store.sessions jest wymagane" }, 400);
    }

    const existing = await countThreads(db);
    if (existing > 0) {
      return c.json({ error: "Serwer już ma wątki — migracja jednorazowa została wykonana" }, 409);
    }

    const migrated = await migrateLocalStore(db, {
      activeSessionId: body.store.activeSessionId ?? body.store.sessions[0]?.id ?? "",
      sessions: body.store.sessions,
    });

    return c.json({
      migrated,
      activeSessionId: body.store.activeSessionId ?? body.store.sessions[0]?.id,
    });
  });

  return migrate;
}
