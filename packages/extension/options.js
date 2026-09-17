const DEFAULT_API = "https://chatgpa.keewinek.deno.net";
const apiInput = document.getElementById("api");
const savedEl = document.getElementById("saved");

chrome.storage.sync.get(["chatgpaApiBase"], (data) => {
  apiInput.value = data.chatgpaApiBase || DEFAULT_API;
});

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = apiInput.value.trim() || DEFAULT_API;
  await chrome.storage.sync.set({ chatgpaApiBase: apiBase });
  savedEl.hidden = false;
  setTimeout(() => {
    savedEl.hidden = true;
  }, 1500);
});
