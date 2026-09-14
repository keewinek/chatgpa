const apiInput = document.getElementById("api");
const syncBtn = document.getElementById("sync");
const statusEl = document.getElementById("status");

const DEFAULT_API = "https://chatgpa.keewinek.deno.net";

chrome.storage.sync.get(["chatgpaApiBase"], (data) => {
  apiInput.value = data.chatgpaApiBase || DEFAULT_API;
});

syncBtn.addEventListener("click", async () => {
  statusEl.textContent = "Synchronizuję…";
  syncBtn.disabled = true;
  const apiBase = apiInput.value.trim() || DEFAULT_API;
  await chrome.storage.sync.set({ chatgpaApiBase: apiBase });

  chrome.runtime.sendMessage({ type: "SYNC_LIBRUS", apiBase }, (response) => {
    syncBtn.disabled = false;
    if (response?.ok) {
      statusEl.textContent = `OK · ${response.counts?.grades ?? 0} ocen · ${
        new Date(response.syncedAt).toLocaleString("pl-PL")
      }`;
    } else {
      statusEl.textContent = response?.error || "Błąd syncu";
    }
  });
});
