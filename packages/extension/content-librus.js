/** Content script on librus.pl — reads DOM when user is logged in. No passwords leave the browser. */

const WEEKDAY_MAP = {
  poniedziałek: "mon",
  poniedzialek: "mon",
  wtorek: "tue",
  środa: "wed",
  sroda: "wed",
  czwartek: "thu",
  piątek: "fri",
  piatek: "fri",
};

function slugId(prefix, parts) {
  return `${prefix}-${parts.filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function parsePolishDate(text) {
  if (!text) return undefined;
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const dmy = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return undefined;
}

function extractGrades() {
  const grades = [];
  const subjects = [];

  // Synergia oceny — tabele z wierszami ocen
  const gradeRows = document.querySelectorAll(
    "table.grades tbody tr, table.oceny tbody tr, .grade-line, tr[class*='line']",
  );

  for (const row of gradeRows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue;
    const subjectName = cells[0]?.textContent?.trim();
    const valueText = cells[1]?.textContent?.trim();
    if (!subjectName || !valueText || subjectName === "Przedmiot") continue;

    const value = parseFloat(valueText.replace(",", "."));
    const grade = {
      id: slugId("grade", [subjectName, valueText, cells[2]?.textContent]),
      subjectName,
      value: Number.isNaN(value) ? valueText : value,
      category: cells[2]?.textContent?.trim() || undefined,
      date: parsePolishDate(cells[3]?.textContent?.trim() || ""),
      weight: parseFloat(cells[4]?.textContent?.replace(",", ".") || "") || undefined,
    };
    grades.push(grade);
  }

  // Przedmioty z nagłówkami sekcji
  const subjectHeaders = document.querySelectorAll(
    "h2.subject-name, .subject-name, .przedmiot-nazwa, caption",
  );
  for (const header of subjectHeaders) {
    const name = header.textContent?.trim();
    if (!name || name.length < 2) continue;
    const section = header.closest("section, table, div.container") || header.parentElement;
    const sectionGrades = [];
    if (section) {
      for (const row of section.querySelectorAll("tr")) {
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) continue;
        const val = tds[0]?.textContent?.trim();
        if (!val || val === "Ocena") continue;
        const num = parseFloat(val.replace(",", "."));
        sectionGrades.push({
          id: slugId("grade", [name, val, tds[1]?.textContent]),
          subjectName: name,
          value: Number.isNaN(num) ? val : num,
          category: tds[1]?.textContent?.trim(),
          date: parsePolishDate(tds[2]?.textContent?.trim() || ""),
        });
      }
    }
    if (sectionGrades.length) {
      subjects.push({ name, grades: sectionGrades });
    }
  }

  return { grades, subjects };
}

function extractSchedule() {
  const days = {};
  const tables = document.querySelectorAll(
    "table.timetable, table.plan-lekcji, #schedule table, table",
  );

  for (const table of tables) {
    const headers = [...table.querySelectorAll("th")].map((th) =>
      th.textContent?.trim().toLowerCase() || ""
    );
    const dayCols = headers
      .map((h, i) => ({ i, day: WEEKDAY_MAP[h] }))
      .filter((x) => x.day);

    if (!dayCols.length) continue;

    for (const row of table.querySelectorAll("tbody tr")) {
      const cells = row.querySelectorAll("td");
      if (!cells.length) continue;
      const slotText = cells[0]?.textContent?.trim();
      const slot = parseInt(slotText, 10);
      if (Number.isNaN(slot)) continue;

      for (const { i, day } of dayCols) {
        const cell = cells[i];
        if (!cell) continue;
        const text = cell.textContent?.trim();
        if (!text || text === "-" || text === "—") continue;
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const lesson = {
          slot,
          subject: lines[0] || text,
          teacher: lines[1],
          room: lines[2],
        };
        if (!days[day]) days[day] = [];
        days[day].push(lesson);
      }
    }
  }

  return Object.keys(days).length ? { days, source: "librus" } : null;
}

function extractCalendarEvents() {
  const exams = [];
  const homeworks = [];

  const eventRows = document.querySelectorAll(
    ".calendar-event, .terminarz-row, table.terminarz tbody tr, .event-row",
  );

  for (const row of eventRows) {
    const text = row.textContent?.trim() || "";
    if (!text) continue;
    const date = parsePolishDate(text);
    const title = row.querySelector(".title, .event-title, td:nth-child(2)")?.textContent?.trim() ||
      text.slice(0, 120);
    const lower = title.toLowerCase();
    const isExam = /sprawdzian|kartkówka|kartkowka|test|egzamin/.test(lower);
    const isHomework = /praca domowa|zadanie|ćwiczenia|cwiczenia/.test(lower);

    if (isExam && date) {
      exams.push({
        title,
        kind: "exam",
        start: `${date}T08:00:00+02:00`,
        source: "librus",
      });
    } else if (isHomework) {
      homeworks.push({
        id: slugId("hw", [title, date]),
        title,
        dueDate: date,
        priority: "medium",
        status: "open",
        source: "librus",
      });
    } else if (date) {
      exams.push({
        title,
        kind: "exam",
        start: `${date}T08:00:00+02:00`,
        source: "librus",
      });
    }
  }

  return { exams, homeworks };
}

function extractTimetableChanges() {
  const changes = [];
  const items = document.querySelectorAll(
    ".substitution, .zastepstwo, .plan-changes li, .timetable-changes tr",
  );

  for (const item of items) {
    const text = item.textContent?.trim();
    if (!text || text.length < 5) continue;
    const date = parsePolishDate(text) || new Date().toISOString().slice(0, 10);
    changes.push({
      id: slugId("change", [date, text.slice(0, 40)]),
      date,
      description: text.slice(0, 200),
    });
  }

  return changes;
}

function extractAll() {
  const { grades, subjects } = extractGrades();
  const schedule = extractSchedule();
  const { exams, homeworks } = extractCalendarEvents();
  const timetableChanges = extractTimetableChanges();

  return {
    syncedAt: new Date().toISOString(),
    grades,
    subjects: subjects.length ? subjects : undefined,
    exams,
    homeworks,
    schedule: schedule || undefined,
    timetableChanges: timetableChanges.length ? timetableChanges : undefined,
    pageUrl: location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LIBRUS_EXTRACT") {
    try {
      sendResponse({ ok: true, data: extractAll() });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }
});
