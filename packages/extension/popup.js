const dotEl = document.getElementById("dot");
const statusEl = document.getElementById("status");
const countsEl = document.getElementById("counts");
const syncBtn = document.getElementById("sync");
const detailsEl = document.getElementById("details");
const notesEl = document.getElementById("notes");

document.getElementById("opts").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function relTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  return `${Math.round(h / 24)} dni temu`;
}

function renderCounts(counts) {
  if (!counts) {
    countsEl.hidden = true;
    return;
  }
  document.getElementById("c-exams").textContent = String(counts.exams ?? 0);
  document.getElementById("c-homeworks").textContent = String(counts.homeworks ?? 0);
  document.getElementById("c-grades").textContent = String(counts.grades ?? 0);
  countsEl.hidden = false;
}

function renderNotes(notes) {
  if (!notes?.length) {
    detailsEl.hidden = true;
    return;
  }
  notesEl.innerHTML = "";
  for (const note of notes.slice(0, 8)) {
    const li = document.createElement("li");
    li.textContent = note;
    notesEl.appendChild(li);
  }
  detailsEl.hidden = false;
}

function renderState({ lastSync, lastCounts, lastNotes, lastError }) {
  if (lastError) {
    dotEl.className = "dot err";
    statusEl.textContent = lastError;
  } else if (lastSync) {
    dotEl.className = "dot ok";
    statusEl.textContent = `Zsynchronizowano ${relTime(lastSync)}`;
  } else {
    dotEl.className = "dot idle";
    statusEl.textContent = "Jeszcze nie synchronizowano";
  }
  renderCounts(lastCounts);
  renderNotes(lastNotes);
}

chrome.storage.local.get(["lastSync", "lastCounts", "lastNotes", "lastError"], renderState);

syncBtn.addEventListener("click", () => {
  dotEl.className = "dot warn";
  statusEl.textContent = "Synchronizuję…";
  syncBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "SYNC_LIBRUS" }, (response) => {
    syncBtn.disabled = false;
    if (response?.ok) {
      renderState({
        lastSync: response.syncedAt,
        lastCounts: response.counts,
        lastNotes: response.merge?.notes,
        lastError: undefined,
      });
    } else {
      dotEl.className = "dot err";
      statusEl.textContent = response?.error || "Błąd syncu";
    }
  });
});
