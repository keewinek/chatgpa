import { assertStringIncludes } from "@std/assert";
import { formatWarsawDateTimeForAi } from "./datetime.ts";

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
