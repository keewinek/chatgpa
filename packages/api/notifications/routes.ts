import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import {
  createDailyPlanNotification,
  getNotification,
  listNotifications,
  markNotificationRead,
  NotificationError,
  runScheduledNotifications,
} from "./service.ts";
import { getVapidPublicKey, savePushSubscription } from "./push.ts";

export function createNotificationRoutes(getDatabase: () => AppDatabase | null) {
  const notifications = new Hono();

  notifications.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const unreadOnly = c.req.query("unread") === "1";
    const items = await listNotifications(db, { unreadOnly });
    return c.json({ notifications: items });
  });

  notifications.get("/vapid-public-key", (c) => {
    const key = getVapidPublicKey();
    return c.json({ publicKey: key, enabled: Boolean(key) });
  });

  notifications.post("/subscribe", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<{
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    }>().catch(() => null);

    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return c.json({ error: "Wymagane: endpoint, keys.p256dh, keys.auth" }, 400);
    }

    await savePushSubscription(db, body.endpoint, {
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });
    return c.json({ ok: true });
  });

  notifications.post("/run", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    try {
      const result = await runScheduledNotifications(db);
      return c.json(result);
    } catch (err) {
      return notificationErrorResponse(c, err);
    }
  });

  notifications.post("/daily-plan", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const date = c.req.query("date") ?? undefined;
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    try {
      const notification = await createDailyPlanNotification(db, targetDate);
      if (!notification) {
        return c.json({ error: "Powiadomienie na ten dzień już istnieje", skipped: true }, 409);
      }
      return c.json({ notification }, 201);
    } catch (err) {
      return notificationErrorResponse(c, err);
    }
  });

  notifications.get("/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const item = await getNotification(db, c.req.param("id"));
    if (!item) return c.notFound();
    return c.json(item);
  });

  notifications.patch("/:id/read", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const item = await markNotificationRead(db, c.req.param("id"));
    if (!item) return c.notFound();
    return c.json(item);
  });

  return notifications;
}

function notificationErrorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  err: unknown,
) {
  if (err instanceof NotificationError) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
}
