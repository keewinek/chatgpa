import { Hono } from "hono";
import type { MemoryKind } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { clearMemory, listMemory, migrateLegacyStrings } from "./service.ts";

function parseKind(value: string | undefined): MemoryKind | "all" | null {
  if (!value) return null;
  if (value === "short" || value === "long" || value === "all") return value;
  return null;
}

export function createMemoryRoutes(getDatabase: () => AppDatabase | null) {
  const memory = new Hono();

  memory.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const kind = c.req.query("kind");
    if (kind && kind !== "short" && kind !== "long") {
      return c.json({ error: "kind musi być short lub long" }, 400);
    }

    const entries = await listMemory(db, {
      kind: kind as MemoryKind | undefined,
      includeExpired: c.req.query("includeExpired") === "true",
    });
    return c.json({ entries });
  });

  memory.post("/migrate", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{ facts?: unknown }>().catch(() => null);
    if (!body || !Array.isArray(body.facts)) {
      return c.json({ error: "Pole facts (string[]) jest wymagane" }, 400);
    }

    const facts = body.facts
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean);

    const migrated = await migrateLegacyStrings(db, facts);
    const entries = await listMemory(db);
    return c.json({ migrated, entries });
  });

  memory.delete("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const kind = parseKind(c.req.query("kind") ?? "short");
    if (!kind) return c.json({ error: "kind musi być short, long lub all" }, 400);

    const cleared = await clearMemory(db, kind);
    const entries = await listMemory(db);
    return c.json({ cleared, entries });
  });

  return memory;
}
