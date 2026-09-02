import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import { pullChanges, pushChanges } from "./service.ts";
import type { SyncChange, SyncPushBody } from "./types.ts";
import { SYNC_ENTITIES } from "./types.ts";

function isSyncChange(value: unknown): value is SyncChange {
  if (!value || typeof value !== "object") return false;
  const change = value as SyncChange;
  if (!SYNC_ENTITIES.includes(change.entity)) return false;
  if (change.op !== "upsert" && change.op !== "delete") return false;
  return true;
}

export function createSyncRoutes(getDatabase: () => AppDatabase | null) {
  const sync = new Hono();

  sync.get("/pull", async (c) => {
    const db = getDatabase();
    if (!db) {
      return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);
    }

    const since = c.req.query("since") ?? null;
    const result = await pullChanges(db, since);
    return c.json(result);
  });

  sync.post("/push", async (c) => {
    const db = getDatabase();
    if (!db) {
      return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);
    }

    const body = await c.req.json<SyncPushBody>().catch(() => null);
    if (!body || !Array.isArray(body.changes)) {
      return c.json({ error: "Pole changes jest wymagane" }, 400);
    }
    if (!body.changes.every(isSyncChange)) {
      return c.json({ error: "Nieprawidłowy format changes" }, 400);
    }

    const result = await pushChanges(db, body.changes);
    return c.json(result);
  });

  return sync;
}
