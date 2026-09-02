import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import {
  notesAppend,
  notesDelete,
  NotesError,
  notesList,
  notesMkdir,
  notesRead,
  notesWrite,
} from "./service.ts";

export function createNotesRoutes(getDatabase: () => AppDatabase | null) {
  const notes = new Hono();

  notes.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const path = c.req.query("path") ?? undefined;
    try {
      const result = await notesList(db, path);
      return c.json(result);
    } catch (err) {
      return notesErrorResponse(c, err);
    }
  });

  notes.get("/file", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const path = c.req.query("path");
    if (!path) return c.json({ error: "Parametr path jest wymagany" }, 400);

    const offset = parseInt(c.req.query("offset") ?? "0", 10);
    const limit = parseInt(c.req.query("limit") ?? "5000", 10);

    try {
      const result = await notesRead(db, path, offset, limit);
      return c.json(result);
    } catch (err) {
      return notesErrorResponse(c, err);
    }
  });

  notes.put("/file", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{ path?: string; content?: string; createOnly?: boolean }>()
      .catch(() => null);
    if (!body?.path || typeof body.content !== "string") {
      return c.json({ error: "Pola path i content są wymagane" }, 400);
    }

    try {
      const result = await notesWrite(db, body.path, body.content, body.createOnly === true);
      return c.json(result);
    } catch (err) {
      return notesErrorResponse(c, err);
    }
  });

  notes.post("/append", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{ path?: string; content?: string }>().catch(() => null);
    if (!body?.path || typeof body.content !== "string") {
      return c.json({ error: "Pola path i content są wymagane" }, 400);
    }

    try {
      const result = await notesAppend(db, body.path, body.content);
      return c.json(result);
    } catch (err) {
      return notesErrorResponse(c, err);
    }
  });

  notes.post("/mkdir", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{ path?: string }>().catch(() => null);
    if (!body?.path) return c.json({ error: "Pole path jest wymagane" }, 400);

    try {
      const result = await notesMkdir(db, body.path);
      return c.json(result);
    } catch (err) {
      return notesErrorResponse(c, err);
    }
  });

  notes.delete("/file", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const path = c.req.query("path");
    if (!path) return c.json({ error: "Parametr path jest wymagany" }, 400);

    try {
      const result = await notesDelete(db, path);
      return c.json(result);
    } catch (err) {
      return notesErrorResponse(c, err);
    }
  });

  return notes;
}

function notesErrorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  err: unknown,
) {
  if (err instanceof NotesError) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
}
