import { and, eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { pushSubscriptions } from "../db/schema.ts";

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

function getVapidKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export function getVapidPublicKey(): string | null {
  return getVapidKeys()?.publicKey ?? null;
}

export async function savePushSubscription(
  db: AppDatabase,
  endpoint: string,
  keys: { p256dh: string; auth: string },
): Promise<void> {
  const now = new Date().toISOString();
  const id = `push-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  await db
    .insert(pushSubscriptions)
    .values({
      id,
      endpoint,
      keys,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { keys, updatedAt: now, deletedAt: null },
    });
}

export async function sendPushToAll(
  db: AppDatabase,
  payload: PushPayload,
): Promise<number> {
  const vapid = getVapidKeys();
  if (!vapid) return 0;

  let webpush: {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    sendNotification: (
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
    ) => Promise<unknown>;
  };

  try {
    webpush = await import("web-push");
  } catch {
    return 0;
  }

  const subject = Deno.env.get("VAPID_SUBJECT")?.trim() ?? "mailto:chatgpa@localhost";
  webpush.setVapidDetails(subject, vapid.publicKey, vapid.privateKey);

  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(isNull(pushSubscriptions.deletedAt));

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url: payload.url ?? "/",
  });

  let sent = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: row.keys },
        body,
      );
      sent++;
    } catch {
      await db
        .update(pushSubscriptions)
        .set({ deletedAt: new Date().toISOString() })
        .where(and(eq(pushSubscriptions.id, row.id), isNull(pushSubscriptions.deletedAt)));
    }
  }

  return sent;
}
