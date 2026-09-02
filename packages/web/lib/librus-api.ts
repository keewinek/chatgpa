import type { LibrusStatus, LibrusSyncResult } from "@chatgpa/core";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchLibrusStatus(): Promise<LibrusStatus> {
  const res = await fetch("/api/librus/status");
  return parseJson<LibrusStatus>(res);
}

export function triggerLibrusSyncViaExtension(
  apiBase = globalThis.location.origin,
): Promise<LibrusSyncResult> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Brak odpowiedzi wtyczki. Zainstaluj packages/extension, otwórz Librus w innej karcie i spróbuj ponownie.",
        ),
      );
    }, 15000);

    function onMessage(event: MessageEvent) {
      if (event.source !== globalThis.window || !event.data) return;
      if (event.data.type !== "CHATGPA_LIBRUS_SYNC_RESULT") return;
      if (event.data.requestId !== requestId) return;

      cleanup();
      if (event.data.ok) {
        resolve(event.data as LibrusSyncResult);
      } else {
        reject(new Error(event.data.error ?? "Sync Librus nie powiódł się"));
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      globalThis.removeEventListener("message", onMessage);
    }

    globalThis.addEventListener("message", onMessage);
    globalThis.postMessage({ type: "CHATGPA_LIBRUS_SYNC", requestId, apiBase }, "*");
  });
}

export function formatLibrusSyncTime(syncedAt: string | null): string {
  if (!syncedAt) return "nigdy";
  const d = new Date(syncedAt);
  if (Number.isNaN(d.getTime())) return syncedAt;
  return d.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
