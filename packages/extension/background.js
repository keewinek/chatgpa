const DEFAULT_API = "http://localhost:8000";

async function getApiBase() {
  const stored = await chrome.storage.sync.get(["chatgpaApiBase"]);
  return stored.chatgpaApiBase || DEFAULT_API;
}

async function syncFromActiveTab(apiBase) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Brak aktywnej karty");

  const isLibrus = tab.url && /librus\.pl/i.test(tab.url);
  if (!isLibrus) {
    throw new Error("Otwórz Librus (synergia.librus.pl) w aktywnej karcie i zaloguj się.");
  }

  const extract = await chrome.tabs.sendMessage(tab.id, { type: "LIBRUS_EXTRACT" });
  if (!extract?.ok) throw new Error(extract?.error || "Nie udało się odczytać danych z Librus");

  const payload = extract.data;
  const res = await fetch(`${apiBase}/api/librus/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

  await chrome.storage.local.set({
    lastSync: body.syncedAt,
    lastCounts: body.counts,
  });

  return body;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SYNC_LIBRUS") {
    (async () => {
      try {
        const apiBase = message.apiBase || await getApiBase();
        const result = await syncFromActiveTab(apiBase);
        sendResponse({ ok: true, ...result });
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }
});

chrome.action.onClicked.addListener(async () => {
  try {
    const apiBase = await getApiBase();
    await syncFromActiveTab(apiBase);
  } catch (err) {
    console.error("[ChatGPA Librus]", err);
  }
});
