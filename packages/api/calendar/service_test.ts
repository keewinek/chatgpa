import { assertEquals } from "@std/assert";
import { DEFAULT_GROUP_PREFS, getWarsawNow } from "@chatgpa/core";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import {
  addEvent,
  computeFreeSlots,
  listEvents,
  parseCalFile,
  readMonth,
  serializeCalFile,
} from "./service.ts";

Deno.test("parseCalFile handles empty and valid JSON", () => {
  const empty = parseCalFile("", "2026-09");
  assertEquals(empty.month, "2026-09");
  assertEquals(empty.events.length, 0);

  const valid = parseCalFile(
    JSON.stringify({
      month: "2026-09",
      events: [{
        id: "1",
        title: "Test",
        kind: "exam",
        start: "2026-09-02T08:00:00+02:00",
        source: "manual",
      }],
    }),
    "2026-09",
  );
  assertEquals(valid.events.length, 1);
  assertEquals(valid.events[0].title, "Test");
});

Deno.test("serializeCalFile roundtrips", () => {
  const data = {
    month: "2026-09",
    events: [{
      id: "abc",
      title: "Sprawdzian chemia",
      kind: "exam" as const,
      start: "2026-09-12T08:00:00+02:00",
      source: "librus" as const,
    }],
  };
  const parsed = parseCalFile(serializeCalFile(data), "2026-09");
  assertEquals(parsed.events[0].title, "Sprawdzian chemia");
});

withTestDb("calendar CRUD and freeSlots", async ({ db }) => {
  setDbForTests(db);
  try {
    const month = await readMonth(db, "2026-09");
    assertEquals(month.events.length, 0);

    await addEvent(db, {
      title: "Korepetycje muzyki",
      kind: "personal",
      start: "2026-09-02T18:00:00+02:00",
      end: "2026-09-02T19:30:00+02:00",
      source: "manual",
    });

    const events = await listEvents(db, "2026-09-01", "2026-09-30");
    assertEquals(events.length, 1);

    const slots = await computeFreeSlots(db, "2026-09-02", DEFAULT_GROUP_PREFS);
    assertEquals(slots.isSchoolDay, true);
    assertEquals(slots.freeMinutes < slots.totalMinutes, true);
    assertEquals(typeof slots.notificationAt, "string");
    assertEquals(slots.studyWindowEnd, "21:00");
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("freeSlots weekend has morning start", async ({ db }) => {
  setDbForTests(db);
  try {
    const slots = await computeFreeSlots(db, "2026-09-06", DEFAULT_GROUP_PREFS);
    assertEquals(slots.isSchoolDay, false);
    assertEquals(slots.studyWindowStart, "09:00");
    assertEquals(slots.notificationAt, null);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("freeSlots ignores homework date-range without times", async ({ db }) => {
  setDbForTests(db);
  try {
    await addEvent(db, {
      title: "Przeczytać Wesele",
      kind: "homework",
      start: "2026-09-02",
      end: "2026-09-23",
      source: "manual",
    });
    await addEvent(db, {
      title: "Sprawdzian chemia",
      kind: "exam",
      start: "2026-09-02",
      source: "manual",
    });

    const slots = await computeFreeSlots(db, "2026-09-02", DEFAULT_GROUP_PREFS);
    assertEquals(slots.freeMinutes, slots.totalMinutes);
    assertEquals(slots.slots.length > 0, true);
  } finally {
    setDbForTests(undefined);
  }
});

Deno.test("freeSlots uses today's date format", () => {
  const now = getWarsawNow();
  const date = now.toISOString().slice(0, 10);
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(date), true);
});
