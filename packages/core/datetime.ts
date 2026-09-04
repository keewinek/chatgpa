const WARSAW_TZ = "Europe/Warsaw";

/**
 * Format Warsaw wall-clock from a real UTC instant.
 * Pass `new Date()` (default) — never `getWarsawNow()`, which would double-apply the offset
 * when the process TZ is UTC (e.g. Deno Deploy).
 */
export function formatWarsawDateTime(now: Date = new Date()): string {
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

/** Datetime block injected into the AI system prompt. */
export function formatWarsawDateTimeForAi(now: Date = new Date()): string {
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
