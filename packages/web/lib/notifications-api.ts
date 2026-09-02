import type { AppNotification } from "@chatgpa/core";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchNotifications(unreadOnly = false): Promise<AppNotification[]> {
  const q = unreadOnly ? "?unread=1" : "";
  const res = await fetch(`/api/notifications${q}`);
  const body = await parseJson<{ notifications: AppNotification[] }>(res);
  return body.notifications;
}

export async function fetchNotification(id: string): Promise<AppNotification> {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`);
  return parseJson<AppNotification>(res);
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
  return parseJson<AppNotification>(res);
}

export async function fetchVapidPublicKey(): Promise<
  { publicKey: string | null; enabled: boolean }
> {
  const res = await fetch("/api/notifications/vapid-public-key");
  return parseJson(res);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerWebPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in globalThis)) return false;

  const { enabled, publicKey } = await fetchVapidPublicKey();
  if (!enabled || !publicKey) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });

  return true;
}

export function notificationFromUrl(): string | null {
  if (typeof globalThis.location === "undefined") return null;
  return new URLSearchParams(globalThis.location.search).get("notification");
}

export function clearNotificationUrl(): void {
  if (typeof globalThis.history === "undefined") return;
  const url = new URL(globalThis.location.href);
  if (!url.searchParams.has("notification")) return;
  url.searchParams.delete("notification");
  globalThis.history.replaceState({}, "", url.pathname + url.search);
}
