import { assertEquals, assertStringIncludes } from "@std/assert";
import { formatWarsawDateTime, formatWarsawDateTimeForAi } from "./datetime.ts";

Deno.test("formatWarsawDateTimeForAi includes weekday, date and time", () => {
  const text = formatWarsawDateTimeForAi(new Date("2026-09-01T18:00:00Z"));
  assertStringIncludes(text, "Dzień tygodnia:");
  assertStringIncludes(text, "Data:");
  assertStringIncludes(text, "Godzina:");
  assertStringIncludes(text, "Europe/Warsaw");
  assertStringIncludes(text, "wtorek");
  assertStringIncludes(text, "1 września 2026");
  assertStringIncludes(text, "20:00");
});

Deno.test("formatWarsawDateTime* uses real instant (no double Warsaw offset)", () => {
  const instant = new Date("2026-09-04T19:08:00Z"); // 21:08 Europe/Warsaw (CEST)
  assertStringIncludes(formatWarsawDateTimeForAi(instant), "21:08");
  assertStringIncludes(formatWarsawDateTime(instant), "21:08");

  // Old bug: getWarsawNow()-style fake Date + timeZone: Europe/Warsaw → +2h on UTC hosts.
  const fakeLocal = new Date(instant.toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
  const doubled = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fakeLocal);
  if (Intl.DateTimeFormat().resolvedOptions().timeZone === "UTC") {
    assertEquals(doubled, "23:08");
  }
  assertEquals(formatWarsawDateTimeForAi(instant).includes("23:08"), false);
});
