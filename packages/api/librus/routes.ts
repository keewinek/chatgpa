import { Hono } from "hono";
import type { LibrusSyncPayload } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { getLibrusStatus, LibrusError, previewLibrusMerge, syncLibrus } from "./service.ts";

const EXTENSION_ORIGIN_RE = /^(chrome-extension|moz-extension):\/\//;
const LIBRUS_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*librus\.pl$/i;

function isAllowedOrigin(origin: string): boolean {
  return origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1") ||
    EXTENSION_ORIGIN_RE.test(origin) || LIBRUS_ORIGIN_RE.test(origin);
}

function withCors(c: { req: { header: (name: string) => string | undefined }; header: (name: string, value: string) => void }): void {
  const origin = c.req.header("origin") ?? "";
  if (origin && isAllowedOrigin(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
  }
}

export function createLibrusRoutes(getDatabase: () => AppDatabase | null) {
  const librus = new Hono();

  librus.options("/sync", (c) => {
    withCors(c);
    c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    return c.body(null, 204);
  });

  librus.options("/merge-preview", (c) => {
    withCors(c);
    c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    return c.body(null, 204);
  });

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
    withCors(c);
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

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
    withCors(c);
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
