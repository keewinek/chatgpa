import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import { FsError, fsDelete, fsList, fsMkdir, fsRead, fsWrite } from "./service.ts";

export function createFsRoutes(getDatabase: () => AppDatabase | null) {
  const fs = new Hono();

  fs.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const path = c.req.query("path") ?? "~";
    try {
      const result = await fsList(db, path);
      return c.json(result);
    } catch (err) {
      return fsErrorResponse(c, err);
    }
  });

  fs.get("/file", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const path = c.req.query("path");
    if (!path) return c.json({ error: "Parametr path jest wymagany" }, 400);

    const offset = parseInt(c.req.query("offset") ?? "0", 10);
    const limit = parseInt(c.req.query("limit") ?? "500", 10);

    try {
      const result = await fsRead(db, path, offset, limit);
      return c.json(result);
    } catch (err) {
      return fsErrorResponse(c, err);
    }
  });

  fs.put("/file", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{ path?: string; content?: string; createOnly?: boolean }>()
      .catch(() => null);
    if (!body?.path || typeof body.content !== "string") {
      return c.json({ error: "Pola path i content są wymagane" }, 400);
    }

    try {
      const result = await fsWrite(db, body.path, body.content, body.createOnly === true);
      return c.json(result);
    } catch (err) {
      return fsErrorResponse(c, err);
    }
  });

  fs.post("/mkdir", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{ path?: string }>().catch(() => null);
    if (!body?.path) return c.json({ error: "Pole path jest wymagane" }, 400);

    try {
      const result = await fsMkdir(db, body.path);
      return c.json(result);
    } catch (err) {
      return fsErrorResponse(c, err);
    }
  });

  fs.delete("/file", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const path = c.req.query("path");
    if (!path) return c.json({ error: "Parametr path jest wymagany" }, 400);

    try {
      const result = await fsDelete(db, path);
      return c.json(result);
    } catch (err) {
      return fsErrorResponse(c, err);
    }
  });

  return fs;
}

function fsErrorResponse(c: { json: (body: unknown, status?: number) => Response }, err: unknown) {
  if (err instanceof FsError) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
}
