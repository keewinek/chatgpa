import { assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { addEvent } from "../calendar/service.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /api/notifications — empty list", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/notifications");
    assertEquals(res.status, 200);
    const body = await res.json() as { notifications: unknown[] };
    assertEquals(Array.isArray(body.notifications), true);
    assertEquals(body.notifications.length, 0);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("POST /api/notifications/daily-plan creates notification", async ({ db }) => {
  setDbForTests(db);
  try {
    await addEvent(db, {
      title: "Sprawdzian Fizyka",
      kind: "exam",
      start: "2026-09-10T08:00:00+02:00",
      source: "manual",
    });

    const app = createApp();
    const res = await app.request("/api/notifications/daily-plan?date=2026-09-02", {
      method: "POST",
    });
    assertEquals(res.status, 201);
    const body = await res.json() as { notification: { id: string; title: string } };
    assertEquals(typeof body.notification.id, "string");
    assertEquals(body.notification.title.includes("Plan na"), true);

    const listRes = await app.request("/api/notifications?unread=1");
    const list = await listRes.json() as { notifications: Array<{ id: string }> };
    assertEquals(list.notifications.some((n) => n.id === body.notification.id), true);

    const readRes = await app.request(`/api/notifications/${body.notification.id}/read`, {
      method: "PATCH",
    });
    assertEquals(readRes.status, 200);
    const readBody = await readRes.json() as { readAt?: string };
    assertEquals(typeof readBody.readAt, "string");
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("GET /api/notifications/vapid-public-key", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/notifications/vapid-public-key");
    assertEquals(res.status, 200);
    const body = await res.json() as { enabled: boolean };
    assertEquals(typeof body.enabled, "boolean");
  } finally {
    setDbForTests(undefined);
  }
});
