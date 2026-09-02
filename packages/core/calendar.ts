export type EventKind = "exam" | "homework" | "study_block" | "personal";
export type EventSource = "librus" | "ai" | "manual";

export interface CalEvent {
  id: string;
  title: string;
  kind: EventKind;
  start: string;
  end?: string;
  source: EventSource;
}

export interface CalMonth {
  month: string;
  events: CalEvent[];
}

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  exam: "Sprawdzian",
  homework: "Praca domowa",
  study_block: "Blok nauki",
  personal: "Prywatne",
};

export const EVENT_KIND_COLORS: Record<EventKind, string> = {
  exam: "#e85d5d",
  homework: "#e8a54b",
  study_block: "#6ab87a",
  personal: "#8b9fd4",
};

export function newEventId(): string {
  return crypto.randomUUID();
}

export function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface TimeSlot {
  start: string;
  end: string;
  minutes: number;
}

export interface FreeSlotsResult {
  date: string;
  weekday: string | null;
  isSchoolDay: boolean;
  lastLessonEnd: string | null;
  studyWindowStart: string;
  studyWindowEnd: string;
  studyWindowEndHard: string;
  totalMinutes: number;
  busyMinutes: number;
  freeMinutes: number;
  slots: TimeSlot[];
  notificationAt: string | null;
}
