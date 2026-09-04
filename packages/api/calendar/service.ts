import type { AppDatabase } from "../db/client.ts";
import { fsList, fsRead, fsWrite } from "../fs/service.ts";
import { FsError } from "../fs/service.ts";
import type {
  CalEvent,
  CalMonth,
  EventKind,
  EventSource,
  FreeSlotsResult,
  TimeSlot,
} from "@chatgpa/core";
import {
  DEFAULT_GROUP_PREFS,
  formatMinutesToTime,
  getDayLessons,
  getWarsawNow,
  type GroupPrefs,
  monthFromDate,
  newEventId,
  parseTimeToMinutes,
  WEEKDAY_LABELS,
  weekdayFromDate,
} from "@chatgpa/core";
import { getProfile } from "../profile/service.ts";
import { formatWarsawIsoDate } from "../plan/distribute.ts";

export const CALENDAR_VIRTUAL_ROOT = "~/calendar";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthPath(month: string): string {
  return `${CALENDAR_VIRTUAL_ROOT}/${month}.cal`;
}

function emptyMonth(month: string): CalMonth {
  return { month, events: [] };
}

export function parseCalFile(content: string, month: string): CalMonth {
  try {
    const data = JSON.parse(content) as CalMonth;
    if (!data || typeof data !== "object") throw new Error("invalid");
    return {
      month: data.month ?? month,
      events: Array.isArray(data.events) ? data.events : [],
    };
  } catch {
    return emptyMonth(month);
  }
}

export function serializeCalFile(data: CalMonth): string {
  return JSON.stringify(data, null, 2) + "\n";
}

export async function readMonth(db: AppDatabase, month: string): Promise<CalMonth> {
  if (!MONTH_RE.test(month)) throw new CalendarError("Miesiąc musi być w formacie YYYY-MM", 400);
  try {
    const file = await fsRead(db, monthPath(month));
    return parseCalFile(file.content, month);
  } catch (err) {
    if (err instanceof FsError && err.status === 404) return emptyMonth(month);
    throw err;
  }
}

export async function writeMonth(db: AppDatabase, data: CalMonth): Promise<void> {
  if (!MONTH_RE.test(data.month)) {
    throw new CalendarError("Miesiąc musi być w formacie YYYY-MM", 400);
  }
  await fsWrite(db, monthPath(data.month), serializeCalFile(data));
}

export async function listMonths(db: AppDatabase): Promise<string[]> {
  const list = await fsList(db, CALENDAR_VIRTUAL_ROOT);
  return list.entries
    .filter((e) => e.kind === "file" && e.name.endsWith(".cal"))
    .map((e) => e.name.replace(/\.cal$/, ""))
    .sort();
}

function monthsInRange(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return [...new Set(months)];
}

function eventDate(event: CalEvent): string {
  return event.start.slice(0, 10);
}

function eventEndDate(event: CalEvent): string {
  return (event.end ?? event.start).slice(0, 10);
}

export async function listEvents(
  db: AppDatabase,
  from?: string,
  to?: string,
): Promise<CalEvent[]> {
  const targetMonths = from && to ? monthsInRange(from, to) : await listMonths(db);

  const events: CalEvent[] = [];
  for (const month of targetMonths) {
    const data = await readMonth(db, month);
    for (const event of data.events) {
      if (from && eventEndDate(event) < from) continue;
      if (to && eventDate(event) > to) continue;
      events.push(event);
    }
  }
  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

export async function addEvent(
  db: AppDatabase,
  event: Omit<CalEvent, "id"> & { id?: string },
): Promise<CalEvent> {
  const date = event.start.slice(0, 10);
  const month = monthFromDate(date);
  const data = await readMonth(db, month);
  const created: CalEvent = { ...event, id: event.id ?? newEventId() };
  data.events.push(created);
  await writeMonth(db, data);
  return created;
}

export async function updateEvent(
  db: AppDatabase,
  id: string,
  patch: Partial<Omit<CalEvent, "id">>,
): Promise<CalEvent | null> {
  const months = await listMonths(db);
  for (const month of months) {
    const data = await readMonth(db, month);
    const idx = data.events.findIndex((e) => e.id === id);
    if (idx === -1) continue;

    const old = data.events[idx];
    const updated: CalEvent = { ...old, ...patch, id };
    data.events[idx] = updated;

    const oldMonth = monthFromDate(old.start);
    const newMonth = monthFromDate(updated.start);
    if (oldMonth !== newMonth) {
      data.events.splice(idx, 1);
      await writeMonth(db, data);
      const target = await readMonth(db, newMonth);
      target.events.push(updated);
      await writeMonth(db, target);
    } else {
      await writeMonth(db, data);
    }
    return updated;
  }
  return null;
}

export async function deleteEvent(db: AppDatabase, id: string): Promise<boolean> {
  const months = await listMonths(db);
  for (const month of months) {
    const data = await readMonth(db, month);
    const idx = data.events.findIndex((e) => e.id === id);
    if (idx === -1) continue;
    data.events.splice(idx, 1);
    await writeMonth(db, data);
    return true;
  }
  return false;
}

interface BusyInterval {
  start: number;
  end: number;
}

/** Tylko timed personal/study_block zajmują okno nauki. Homework/exam to terminy, nie busy. */
function isBusyBlockEvent(event: CalEvent): boolean {
  if (event.kind !== "personal" && event.kind !== "study_block") return false;
  return event.start.includes("T");
}

function eventToMinutesOnDate(event: CalEvent, date: string): BusyInterval | null {
  if (!isBusyBlockEvent(event)) return null;

  const eventDay = eventDate(event);
  const endDay = eventEndDate(event);
  if (date < eventDay || date > endDay) return null;

  const dayStart = parseTimeToMinutes("00:00");
  const dayEnd = parseTimeToMinutes("23:59");

  let startMin = dayStart;
  let endMin = dayEnd;

  if (eventDay === date) {
    const t = event.start.includes("T") ? event.start.split("T")[1] : "00:00";
    startMin = parseTimeToMinutes(t.slice(0, 5));
  }
  if (endDay === date) {
    const endStr = event.end ?? event.start;
    const t = endStr.includes("T") ? endStr.split("T")[1] : "23:59";
    endMin = parseTimeToMinutes(t.slice(0, 5));
  }

  if (endMin <= startMin) endMin = startMin + 30;
  return { start: startMin, end: endMin };
}

function subtractBusy(
  windowStart: number,
  windowEnd: number,
  busy: BusyInterval[],
): TimeSlot[] {
  let free: BusyInterval[] = [{ start: windowStart, end: windowEnd }];
  for (const b of busy) {
    free = free.flatMap((slot) => {
      if (b.end <= slot.start || b.start >= slot.end) return [slot];
      const parts: BusyInterval[] = [];
      if (b.start > slot.start) parts.push({ start: slot.start, end: b.start });
      if (b.end < slot.end) parts.push({ start: b.end, end: slot.end });
      return parts;
    });
  }
  return free
    .filter((s) => s.end > s.start)
    .map((s) => ({
      start: formatMinutesToTime(s.start),
      end: formatMinutesToTime(s.end),
      minutes: s.end - s.start,
    }));
}

export async function computeFreeSlots(
  db: AppDatabase,
  date: string,
  groupPrefs: GroupPrefs = DEFAULT_GROUP_PREFS,
): Promise<FreeSlotsResult> {
  if (!DATE_RE.test(date)) throw new CalendarError("Data musi być w formacie YYYY-MM-DD", 400);

  const profile = await getProfile(db);
  const d = new Date(`${date}T12:00:00`);
  const weekday = weekdayFromDate(d);
  const isSchoolDay = weekday !== null;

  let studyStartMin: number;
  let lastLessonEnd: string | null = null;
  let notificationAt: string | null = null;

  if (isSchoolDay && weekday) {
    const lessons = getDayLessons(weekday, groupPrefs).filter((e) => e.lesson);
    if (lessons.length) {
      const last = lessons[lessons.length - 1];
      const lastEndMin = parseTimeToMinutes(last.time.end);
      lastLessonEnd = last.time.end;
      studyStartMin = lastEndMin +
        profile.commuteAfterSchoolMinutes +
        profile.commuteExtraMinutes +
        profile.showerAndBreakMinutes;
      notificationAt = formatMinutesToTime(
        lastEndMin + profile.notificationAfterSchoolMinutes,
      );
    } else {
      studyStartMin = parseTimeToMinutes("09:00");
    }
  } else {
    studyStartMin = parseTimeToMinutes("09:00");
  }

  const studyEndPreferredMin = parseTimeToMinutes(profile.studyEndPreferred);
  const studyEndHardMin = parseTimeToMinutes(profile.studyEndHard);
  let studyEndMin = studyEndPreferredMin;

  // Dla „dziś”: nie planuj w przeszłości; gdy mało czasu do preferred — użyj hard end.
  const today = formatWarsawIsoDate();
  if (date === today) {
    const now = getWarsawNow();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const soonBuffer = 5;
    studyStartMin = Math.max(studyStartMin, nowMin + soonBuffer);
    if (studyEndPreferredMin - studyStartMin < 30 && studyEndHardMin > studyStartMin) {
      studyEndMin = studyEndHardMin;
    }
    if (studyStartMin >= studyEndMin) {
      // Po oknie nauki — brak slotów dziś.
      studyStartMin = studyEndMin;
    }
  }

  const events = await listEvents(db, date, date);
  const busy: BusyInterval[] = [];
  for (const event of events) {
    const interval = eventToMinutesOnDate(event, date);
    if (interval) busy.push(interval);
  }

  const slots = subtractBusy(studyStartMin, studyEndMin, busy);
  const totalWindow = Math.max(0, studyEndMin - studyStartMin);
  const freeMinutes = slots.reduce((sum, s) => sum + s.minutes, 0);
  const busyMinutes = totalWindow - freeMinutes;

  return {
    date,
    weekday: weekday ? WEEKDAY_LABELS[weekday] : null,
    isSchoolDay,
    lastLessonEnd,
    studyWindowStart: formatMinutesToTime(studyStartMin),
    studyWindowEnd: formatMinutesToTime(studyEndMin),
    studyWindowEndHard: formatMinutesToTime(studyEndHardMin),
    totalMinutes: totalWindow,
    busyMinutes: Math.max(0, busyMinutes),
    freeMinutes,
    slots,
    notificationAt,
  };
}

export function formatFreeSlotsForAi(result: FreeSlotsResult): string {
  const lines = [
    `Wolne okna nauki — ${result.date}${result.weekday ? ` (${result.weekday})` : " (weekend)"}`,
    `Okno nauki: ${result.studyWindowStart}–${result.studyWindowEnd} (max do ${result.studyWindowEndHard})`,
  ];
  if (result.lastLessonEnd) {
    lines.push(`Ostatnia lekcja kończy: ${result.lastLessonEnd}`);
  }
  if (result.notificationAt) {
    lines.push(`Powiadomienie po szkole: ~${result.notificationAt}`);
  }
  lines.push(
    `Budżet: ~${result.freeMinutes} min wolnej nauki (${result.busyMinutes} min zajęte)`,
  );
  if (result.slots.length) {
    lines.push("Sloty:");
    for (const slot of result.slots) {
      lines.push(`- ${slot.start}–${slot.end} (${slot.minutes} min)`);
    }
  } else {
    lines.push("Brak wolnych slotów w preferowanym oknie nauki.");
  }
  return lines.join("\n");
}

export function formatEventsForAi(events: CalEvent[]): string {
  if (!events.length) return "Brak wydarzeń w podanym zakresie.";
  return events.map((e) => {
    const end = e.end ? ` – ${e.end.slice(11, 16)}` : "";
    return `- [${e.kind}] ${e.title}: ${e.start.slice(0, 10)} ${
      e.start.slice(11, 16)
    }${end} (${e.source})`;
  }).join("\n");
}

export class CalendarError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}

export type { EventKind, EventSource };
