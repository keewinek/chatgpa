import { assertEquals } from "@std/assert";
import {
  formatCurrentLesson,
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

Deno.test("formatCurrentLesson reports a lesson during Monday's first slot", () => {
  const mon0810 = new Date("2026-09-07T08:10:00");
  const text = formatCurrentLesson(undefined, mon0810);
  assertEquals(text.includes("Matematyka"), true);
});

Deno.test("formatCurrentLesson reports weekend with no lessons", () => {
  const sat = new Date("2026-09-05T12:00:00");
  const text = formatCurrentLesson(undefined, sat);
  assertEquals(text.includes("weekend"), true);
});
