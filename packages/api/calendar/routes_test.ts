import { assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /api/calendar lists months", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/calendar");
    assertEquals(res.status, 200);
    const body = await res.json() as { months: string[] };
    assertEquals(Array.isArray(body.months), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("calendar events CRUD via API", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();

    const addRes = await app.request("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Sprawdzian chemia",
        kind: "exam",
        start: "2026-09-12T08:00:00+02:00",
        source: "manual",
      }),
    });
    assertEquals(addRes.status, 200);
    const event = await addRes.json() as { id: string; title: string };
    assertEquals(event.title, "Sprawdzian chemia");

    const monthRes = await app.request("/api/calendar/month?month=2026-09");
    assertEquals(monthRes.status, 200);
    const month = await monthRes.json() as { events: Array<{ id: string }> };
    assertEquals(month.events.some((e) => e.id === event.id), true);

    const listRes = await app.request("/api/calendar?from=2026-09-01&to=2026-09-30");
    const list = await listRes.json() as { events: unknown[] };
    assertEquals(list.events.length >= 1, true);

    const patchRes = await app.request(`/api/calendar/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sprawdzian chemia — poprawiony" }),
    });
    assertEquals(patchRes.status, 200);

    const delRes = await app.request(`/api/calendar/events/${event.id}`, { method: "DELETE" });
    assertEquals(delRes.status, 200);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("GET /api/calendar/free-slots", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/calendar/free-slots?date=2026-09-02");
    assertEquals(res.status, 200);
    const body = await res.json() as { freeMinutes: number; slots: unknown[] };
    assertEquals(typeof body.freeMinutes, "number");
    assertEquals(Array.isArray(body.slots), true);
  } finally {
    setDbForTests(undefined);
  }
});
