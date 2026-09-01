import { getWarsawNow } from "./timetable.ts";

const WARSAW_TZ = "Europe/Warsaw";

export function formatWarsawDateTime(now: Date = getWarsawNow()): string {
  const weekday = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    weekday: "long",
  }).format(now);

  const date = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    dateStyle: "long",
  }).format(now);

  const time = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    timeStyle: "short",
  }).format(now);

  return `${weekday}, ${date}, ${time}`;
}

export function formatWarsawDateTimeForAi(now: Date = getWarsawNow()): string {
  const weekday = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    weekday: "long",
  }).format(now);

  const date = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const time = new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return [
    "Aktualna data i czas ucznia (strefa Europe/Warsaw — traktuj jako prawdę, nie zgaduj):",
    `- Dzień tygodnia: ${weekday}`,
    `- Data: ${date}`,
    `- Godzina: ${time}`,
  ].join("\n");
}
