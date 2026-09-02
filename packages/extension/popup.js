const apiInput = document.getElementById("api");
const syncBtn = document.getElementById("sync");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(["chatgpaApiBase"], (data) => {
  apiInput.value = data.chatgpaApiBase || "http://localhost:8000";
});

syncBtn.addEventListener("click", async () => {
  statusEl.textContent = "Synchronizuję…";
  syncBtn.disabled = true;
  const apiBase = apiInput.value.trim() || "http://localhost:8000";
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
