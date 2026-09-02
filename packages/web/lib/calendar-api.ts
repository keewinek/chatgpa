import type { CalEvent, CalMonth, EventKind, FreeSlotsResult } from "@chatgpa/core";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchCalendarMonths(): Promise<string[]> {
  const res = await fetch("/api/calendar");
  const body = await parseJson<{ months: string[] }>(res);
  return body.months;
}

export async function fetchCalendarMonth(month: string): Promise<CalMonth> {
  const res = await fetch(`/api/calendar/month?month=${encodeURIComponent(month)}`);
  return parseJson<CalMonth>(res);
}

export async function fetchCalendarEvents(from: string, to: string): Promise<CalEvent[]> {
  const q = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(`/api/calendar${q}`);
  const body = await parseJson<{ events: CalEvent[] }>(res);
  return body.events;
}

export async function createCalendarEvent(
  event: Omit<CalEvent, "id">,
): Promise<CalEvent> {
  const res = await fetch("/api/calendar/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  return parseJson<CalEvent>(res);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const res = await fetch(`/api/calendar/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseJson(res);
}

export async function fetchFreeSlots(date: string): Promise<FreeSlotsResult> {
  const res = await fetch(`/api/calendar/free-slots?date=${encodeURIComponent(date)}`);
  return parseJson<FreeSlotsResult>(res);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${
    String(date.getDate()).padStart(2, "0")
  }`;
}

export const KIND_LABELS: Record<EventKind, string> = {
  exam: "Sprawdzian",
  homework: "Praca domowa",
  study_block: "Nauka",
  personal: "Prywatne",
};

export const KIND_COLORS: Record<EventKind, string> = {
  exam: "#e85d5d",
  homework: "#e8a54b",
  study_block: "#6ab87a",
  personal: "#8b9fd4",
};
