/** Bridge on ChatGPA origin — forwards sync requests to the extension background worker. */

const EXTENSION_PING = "chatgpa-librus-bridge";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CHATGPA_LIBRUS_SYNC") return;

  chrome.runtime.sendMessage({ type: "SYNC_LIBRUS", apiBase: data.apiBase }, (response) => {
    window.postMessage({
      type: "CHATGPA_LIBRUS_SYNC_RESULT",
      requestId: data.requestId,
      ...response,
    }, "*");
  });
});

// Signal that extension bridge is available
window.postMessage({ type: "CHATGPA_LIBRUS_BRIDGE_READY" }, "*");
