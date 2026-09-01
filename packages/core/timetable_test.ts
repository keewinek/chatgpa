import { assertEquals } from "@std/assert";
import {
  formatDaySchedule,
  getDayLessons,
  TIMETABLE_META,
  weekdayFromDate,
} from "@chatgpa/core";

Deno.test("timetable meta matches class 3A", () => {
  assertEquals(TIMETABLE_META.className, "3A");
  assertEquals(TIMETABLE_META.school.includes("CXXII"), true);
});

Deno.test("monday has matematyka as first lesson", () => {
  const lessons = getDayLessons("mon");
  assertEquals(lessons[0].lesson?.subject, "Matematyka");
});

Deno.test("formatDaySchedule includes time slots", () => {
  const text = formatDaySchedule("fri");
  assertEquals(text.includes("Piątek"), true);
  assertEquals(text.includes("08:00"), true);
});

Deno.test("weekdayFromDate maps monday", () => {
  const mon = new Date("2026-09-07T10:00:00");
  assertEquals(weekdayFromDate(mon), "mon");
});
