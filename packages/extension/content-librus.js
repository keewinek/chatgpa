/**
 * Content script on librus.pl — reads DOM/HTML when user is logged in. No passwords leave the
 * browser. Selectors below were verified against live Synergia pages (terminarz, plan lekcji,
 * oceny) in September 2026 — Librus can change its markup without notice, so if sync goes quiet
 * again these are the first place to check.
 *
 * Grades (parseGradesDoc) are the one part that is still best-effort: at verification time the
 * logged-in account had zero grades issued, so the grade-badge markup itself couldn't be checked.
 * Subject names are reliable; individual grade values may need another pass once real grades exist.
 */

const DEFAULT_API = "https://chatgpa.keewinek.deno.net";
const AUTO_SYNC_THROTTLE_MS = 15 * 60 * 1000;

const EXAM_RE =
  /sprawdzian|kartk[oó]wk|klas[oó]wk|egzamin|praca klasowa|map[oó]wk|powt[oó]rzeni|test\b/i;
const HOMEWORK_RE = /praca domowa|zadanie domowe|^pd\b/i;

function slugId(prefix, parts) {
  return `${prefix}-${parts.filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function weekdayFromDate(dateStr) {
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const d = new Date(`${dateStr}T00:00:00`);
  return map[d.getDay()];
}

async function fetchDoc(url, init) {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) return null;
  const html = await res.text();
  return new DOMParser().parseFromString(html, "text/html");
}

/* ---------- Oceny (grades) ---------- */

function parseGradesDoc(doc) {
  const tables = [...doc.querySelectorAll("table.decorated.stretch")];
  const table = tables.find((t) => /Przedmiot/.test(t.textContent) && /Śr\.I/.test(t.textContent));
  if (!table) return { grades: [], subjects: [] };

  const subjects = [];
  const grades = [];
  const skip = new Set(["przedmiot", "zachowanie"]);

  for (const row of table.querySelectorAll("tbody tr, tr")) {
    const nameCell = row.querySelector("td:first-child, th:first-child");
    const name = nameCell?.textContent?.trim();
    if (!name || skip.has(name.toLowerCase())) continue;

    const subjectGrades = [];
    for (const badge of row.querySelectorAll("[title]")) {
      const value = badge.textContent?.trim();
      if (!value || value.length > 3) continue;
      const grade = {
        id: slugId("grade", [name, value, badge.getAttribute("title")?.slice(0, 20)]),
        subjectName: name,
        value: Number.isNaN(parseFloat(value.replace(",", "."))) ? value : parseFloat(value.replace(",", ".")),
      };
      subjectGrades.push(grade);
      grades.push(grade);
    }
    subjects.push({ name, grades: subjectGrades });
  }

  return { grades, subjects };
}

async function extractGrades() {
  const doc = await fetchDoc("https://synergia.librus.pl/przegladaj_oceny/uczen");
  if (!doc) return { grades: [], subjects: [] };
  return parseGradesDoc(doc);
}

/* ---------- Terminarz (kalendarz: sprawdziany, prace domowe, inne wydarzenia) ---------- */

function parseCalendarDoc(doc, month, year) {
  const exams = [];
  const homeworks = [];
  const table = doc.querySelector("table.kalendarz");
  if (!table) return { exams, homeworks };

  for (const dayBox of table.querySelectorAll(".kalendarz-dzien")) {
    const dayText = dayBox.querySelector(".kalendarz-numer-dnia")?.textContent?.trim();
    const day = parseInt(dayText || "", 10);
    if (Number.isNaN(day)) continue;
    const date = `${year}-${pad2(month)}-${pad2(day)}`;

    for (const cell of dayBox.querySelectorAll("td[onclick]")) {
      const idMatch = cell.getAttribute("onclick")?.match(/terminarz\/szczegoly\/(\d+)/);
      const eventId = idMatch ? idMatch[1] : slugId("ev", [date, cell.textContent.slice(0, 20)]);

      const lines = (cell.textContent || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const bodyLines = lines.filter((l) => !/^(Nr lekcji|Czas):/i.test(l) && !/^Sala:/i.test(l));
      const firstLine = bodyLines[0] || "";
      const [maybeSubject, maybeRodzaj] = firstLine.split(",").map((s) => s.trim());
      const subject = maybeRodzaj ? maybeSubject : undefined;
      const rodzaj = maybeRodzaj || maybeSubject || "";

      const title = cell.getAttribute("title") || "";
      const opisMatch = title.match(/Opis:\s*([\s\S]*?)(?:<br\s*\/?>|$)/i);
      const opis = opisMatch ? opisMatch[1].trim() : "";

      const haystack = `${rodzaj} ${opis}`.toLowerCase();
      const label = [subject, opis || rodzaj].filter(Boolean).join(" — ") || rodzaj || "Wydarzenie";

      if (HOMEWORK_RE.test(haystack) && !EXAM_RE.test(haystack)) {
        homeworks.push({
          id: slugId("hw-librus", [eventId]),
          title: label,
          dueDate: date,
          priority: "medium",
          status: "open",
          source: "librus",
        });
      } else if (EXAM_RE.test(haystack)) {
        exams.push({
          id: slugId("exam-librus", [eventId]),
          title: label,
          kind: "exam",
          start: `${date}T08:00:00+02:00`,
          source: "librus",
        });
      }
    }
  }

  return { exams, homeworks };
}

async function extractCalendarEvents() {
  const exams = [];
  const homeworks = [];

  let doc = await fetchDoc("https://synergia.librus.pl/terminarz");
  if (!doc) return { exams, homeworks };

  let month = parseInt(doc.querySelector('select[name="miesiac"]')?.value || "", 10);
  let year = parseInt(doc.querySelector('select[name="rok"]')?.value || "", 10);
  let requestkey = doc.querySelector('input[name="requestkey"]')?.value;

  if (!Number.isNaN(month) && !Number.isNaN(year)) {
    const first = parseCalendarDoc(doc, month, year);
    exams.push(...first.exams);
    homeworks.push(...first.homeworks);

    // dociągnij kolejne 2 miesiące, żeby złapać nadchodzące sprawdziany z wyprzedzeniem
    for (let i = 0; i < 2; i++) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const body = new URLSearchParams({
        requestkey: requestkey || "",
        miesiac: String(month),
        rok: String(year),
      });
      const nextDoc = await fetchDoc("https://synergia.librus.pl/terminarz", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!nextDoc) break;
      requestkey = nextDoc.querySelector('input[name="requestkey"]')?.value || requestkey;
      const parsed = parseCalendarDoc(nextDoc, month, year);
      exams.push(...parsed.exams);
      homeworks.push(...parsed.homeworks);
    }
  }

  return { exams, homeworks };
}

/* ---------- Plan lekcji ---------- */

function parseScheduleDoc(doc) {
  const table = doc.querySelector("table.plan-lekcji");
  if (!table) return null;

  const days = {};
  for (const cell of table.querySelectorAll('td[data-date]')) {
    const date = cell.getAttribute("data-date");
    if (!date) continue;
    const day = weekdayFromDate(date);
    const slotText = cell.closest("tr")?.querySelector("td.center")?.textContent?.trim();
    const slot = parseInt(slotText || "", 10);
    const textEl = cell.querySelector(".text");
    const subject = textEl?.querySelector("b")?.textContent?.trim();
    if (!subject) continue;

    const rest = (textEl.textContent || "").replace(subject, "").replace(/^-/, "").trim();
    const roomMatch = rest.match(/s\.\s*(\S+)\s*$/i);
    const lesson = {
      slot: Number.isNaN(slot) ? 0 : slot,
      subject,
      teacher: rest.replace(/\s*s\.\s*\S+\s*$/i, "").trim() || undefined,
      room: roomMatch ? roomMatch[1] : undefined,
    };

    if (!days[day]) days[day] = [];
    days[day].push(lesson);
  }

  return Object.keys(days).length ? { days, source: "librus" } : null;
}

async function extractSchedule() {
  const doc = await fetchDoc("https://synergia.librus.pl/przegladaj_plan_lekcji");
  if (!doc) return null;
  return parseScheduleDoc(doc);
}

/* ---------- Aggregate + sync ---------- */

async function extractAll() {
  const [{ grades, subjects }, { exams, homeworks }, schedule] = await Promise.all([
    extractGrades(),
    extractCalendarEvents(),
    extractSchedule(),
  ]);

  return {
    syncedAt: new Date().toISOString(),
    grades,
    subjects: subjects.length ? subjects : undefined,
    exams,
    homeworks,
    schedule: schedule || undefined,
    pageUrl: location.href,
  };
}

async function postSync(apiBase, data) {
  const res = await fetch(`${apiBase}/api/librus/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function autoSyncIfDue() {
  const { lastAutoSync } = await chrome.storage.local.get(["lastAutoSync"]);
  if (lastAutoSync && Date.now() - lastAutoSync < AUTO_SYNC_THROTTLE_MS) return;
  await chrome.storage.local.set({ lastAutoSync: Date.now() });

  try {
    const data = await extractAll();
    const { chatgpaApiBase } = await chrome.storage.sync.get(["chatgpaApiBase"]);
    const body = await postSync(chatgpaApiBase || DEFAULT_API, data);
    await chrome.storage.local.set({ lastSync: body.syncedAt, lastCounts: body.counts });
    console.log("[ChatGPA Librus] auto-sync OK", body.counts);
  } catch (err) {
    console.warn("[ChatGPA Librus] auto-sync failed", err);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LIBRUS_EXTRACT") {
    (async () => {
      try {
        sendResponse({ ok: true, data: await extractAll() });
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }
});

// Zero-click sync: uruchamia się samo (throttlowane) przy każdej wizycie na Librusie.
void autoSyncIfDue();
