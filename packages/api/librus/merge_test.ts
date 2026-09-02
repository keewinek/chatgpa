import { assertEquals } from "@std/assert";
import type { CalEvent, GradesSnapshot, LibrusSyncPayload } from "@chatgpa/core";
import {
  buildMergeDiff,
  mergeCalendarEvents,
  mergeGradesSnapshot,
  mergeScheduleSnapshot,
  mergeTimetableChanges,
} from "./merge.ts";

Deno.test("mergeGradesSnapshot adds new grades without removing existing", () => {
  const existing: GradesSnapshot = {
    syncedAt: "2026-09-01T10:00:00+02:00",
    subjects: [{
      name: "Chemia",
      average: 4,
      grades: [{
        id: "g1",
        subjectName: "Chemia",
        value: 4,
        category: "sprawdzian",
        date: "2026-09-01",
      }],
    }],
  };

  const payload: LibrusSyncPayload = {
    syncedAt: "2026-09-02T10:00:00+02:00",
    grades: [{
      id: "g2",
      subjectName: "Chemia",
      value: 5,
      category: "kartkówka",
      date: "2026-09-02",
    }],
  };

  const { merged, diff } = mergeGradesSnapshot(existing, payload);
  assertEquals(merged.subjects[0].grades.length, 2);
  assertEquals(diff.newGrades, 1);
  assertEquals(diff.removedGrades, 0);
});

Deno.test("mergeCalendarEvents preserves manual events", () => {
  const existing: CalEvent[] = [
    {
      id: "manual-1",
      title: "Lekarz",
      kind: "personal",
      start: "2026-09-10T15:00:00+02:00",
      source: "manual",
    },
    {
      id: "lib-1",
      title: "Sprawdzian chemia",
      kind: "exam",
      start: "2026-09-12T08:00:00+02:00",
      source: "librus",
    },
  ];

  const { events, diff } = mergeCalendarEvents(existing, [{
    id: "lib-new",
    title: "Sprawdzian chemia",
    kind: "exam",
    start: "2026-09-12T09:00:00+02:00",
    source: "librus",
  }], []);

  assertEquals(events.some((e) => e.source === "manual"), true);
  assertEquals(diff.updatedExams, 1);
  assertEquals(events.find((e) => e.id === "lib-1")?.start.includes("09:00"), true);
});

Deno.test("mergeScheduleSnapshot detects changes", () => {
  const existing = {
    syncedAt: "2026-09-01T10:00:00+02:00",
    days: { mon: [{ slot: 1, subject: "Chemia" }] },
  };

  const { scheduleChanged, notes } = mergeScheduleSnapshot(existing, {
    days: { mon: [{ slot: 1, subject: "Biologia" }] },
  }, "2026-09-02T10:00:00+02:00");

  assertEquals(scheduleChanged, true);
  assertEquals(notes.length > 0, true);
});

Deno.test("mergeTimetableChanges dedupes by id", () => {
  const existing = {
    syncedAt: "2026-09-01T10:00:00+02:00",
    changes: [{ id: "c1", date: "2026-09-03", description: "Zastępstwo" }],
  };

  const { merged, newTimetableChanges } = mergeTimetableChanges(
    existing,
    [
      { id: "c1", date: "2026-09-03", description: "Zastępstwo" },
      { id: "c2", date: "2026-09-04", description: "Odwołane WF" },
    ],
    "2026-09-02T10:00:00+02:00",
  );

  assertEquals(newTimetableChanges, 1);
  assertEquals(merged.changes.length, 2);
});

Deno.test("buildMergeDiff aggregates notes", () => {
  const diff = buildMergeDiff({
    newGrades: 2,
    notes: ["2 nowe oceny", "1 nowy termin"],
  });
  assertEquals(diff.newGrades, 2);
  assertEquals(diff.notes.length, 2);
});
