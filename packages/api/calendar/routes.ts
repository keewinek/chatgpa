import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import type { CalEvent } from "@chatgpa/core";
import {
  addEvent,
  CalendarError,
  computeFreeSlots,
  deleteEvent,
  listEvents,
  listMonths,
  readMonth,
  updateEvent,
  writeMonth,
} from "./service.ts";

export function createCalendarRoutes(getDatabase: () => AppDatabase | null) {
  const calendar = new Hono();

  calendar.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const from = c.req.query("from") ?? undefined;
    const to = c.req.query("to") ?? undefined;

    try {
      if (from || to) {
        const events = await listEvents(db, from, to);
        return c.json({ events });
      }
      const months = await listMonths(db);
      return c.json({ months });
    } catch (err) {
      return calendarErrorResponse(c, err);
    }
  });

  calendar.get("/month", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const month = c.req.query("month");
    if (!month) return c.json({ error: "Parametr month jest wymagany (YYYY-MM)" }, 400);

    try {
      const data = await readMonth(db, month);
      return c.json(data);
    } catch (err) {
      return calendarErrorResponse(c, err);
    }
  });

  calendar.put("/month", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{ month?: string; events?: CalEvent[] }>().catch(() => null);
    if (!body?.month) return c.json({ error: "Pole month jest wymagane" }, 400);

    try {
      await writeMonth(db, { month: body.month, events: body.events ?? [] });
      return c.json({ month: body.month });
    } catch (err) {
      return calendarErrorResponse(c, err);
    }
  });

  calendar.post("/events", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Partial<CalEvent>>().catch(() => null);
    if (!body?.title || !body?.start || !body?.kind || !body?.source) {
      return c.json({ error: "Pola title, kind, start, source są wymagane" }, 400);
    }

    try {
      const event = await addEvent(db, {
        title: body.title,
        kind: body.kind,
        start: body.start,
        end: body.end,
        source: body.source,
        id: body.id,
      });
      return c.json(event);
    } catch (err) {
      return calendarErrorResponse(c, err);
    }
  });

  calendar.patch("/events/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const id = c.req.param("id");
    const body = await c.req.json<Partial<CalEvent>>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    try {
      const updated = await updateEvent(db, id, body);
      if (!updated) return c.json({ error: "Wydarzenie nie znalezione" }, 404);
      return c.json(updated);
    } catch (err) {
      return calendarErrorResponse(c, err);
    }
  });

  calendar.delete("/events/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    try {
      const ok = await deleteEvent(db, c.req.param("id"));
      if (!ok) return c.json({ error: "Wydarzenie nie znalezione" }, 404);
      return c.json({ ok: true });
    } catch (err) {
      return calendarErrorResponse(c, err);
    }
  });

  calendar.get("/free-slots", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const date = c.req.query("date");
    if (!date) return c.json({ error: "Parametr date jest wymagany (YYYY-MM-DD)" }, 400);

    try {
      const result = await computeFreeSlots(db, date);
      return c.json(result);
    } catch (err) {
      return calendarErrorResponse(c, err);
    }
  });

  return calendar;
}

function calendarErrorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  err: unknown,
) {
  if (err instanceof CalendarError) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
}
