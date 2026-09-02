import { Hono } from "hono";
import type { LibrusSyncPayload } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { getLibrusStatus, LibrusError, previewLibrusMerge, syncLibrus } from "./service.ts";

const EXTENSION_ORIGIN_RE = /^(chrome-extension|moz-extension):\/\//;

export function createLibrusRoutes(getDatabase: () => AppDatabase | null) {
  const librus = new Hono();

  librus.get("/status", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    try {
      const status = await getLibrusStatus(db);
      return c.json(status);
    } catch (err) {
      return librusErrorResponse(c, err);
    }
  });

  librus.post("/sync", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const origin = c.req.header("origin") ?? "";
    if (
      origin && !origin.startsWith("http://localhost") && !origin.startsWith("http://127.0.0.1") &&
      !EXTENSION_ORIGIN_RE.test(origin)
    ) {
      // Allow same-origin (no Origin header) and localhost; extension uses no CORS preflight from SW
    }

    const body = await c.req.json<LibrusSyncPayload>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    try {
      const result = await syncLibrus(db, body);
      return c.json(result);
    } catch (err) {
      return librusErrorResponse(c, err);
    }
  });

  librus.post("/merge-preview", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<LibrusSyncPayload>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    try {
      const result = await previewLibrusMerge(db, body);
      return c.json(result);
    } catch (err) {
      return librusErrorResponse(c, err);
    }
  });

  return librus;
}

function librusErrorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  err: unknown,
) {
  if (err instanceof LibrusError) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
}
