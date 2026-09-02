import { assertEquals } from "@std/assert";
import {
  addDaysIso,
  collectExamAlerts,
  daysBetween,
  distributeExamPrep,
  mergeStudyItems,
} from "./distribute.ts";
import type { ExamPrepItem } from "./types.ts";
import { assignBlocksToSlots, examsFromCalendar } from "./service.ts";

Deno.test("daysBetween counts calendar days", () => {
  assertEquals(daysBetween("2026-09-02", "2026-09-09"), 7);
  assertEquals(daysBetween("2026-09-09", "2026-09-02"), -7);
});

Deno.test("distributeExamPrep — T-7 małe porcje, T-3 większe", () => {
  const exam: ExamPrepItem = {
    examId: "exam-1",
    title: "Chemia: kwasy",
    subjectId: "chemia",
    examDate: "2026-09-09",
    totalMinutes: 90,
    roiScore: 1.5,
  };

  const t7 = distributeExamPrep([exam], "2026-09-02");
  assertEquals(t7.length, 1);
  assertEquals(t7[0].alertKind, "t7");
  assertEquals(t7[0].minutes >= 15 && t7[0].minutes <= 25, true);

  const t3 = distributeExamPrep([exam], "2026-09-06");
  assertEquals(t3.length, 1);
  assertEquals(t3[0].alertKind, "t3");
  assertEquals(t3[0].minutes >= 25, true);

  const beforeWindow = distributeExamPrep([exam], addDaysIso(exam.examDate, -8));
  assertEquals(beforeWindow.length, 0);
});

Deno.test("collectExamAlerts — T-7, T-3, T-1", () => {
  const exams: ExamPrepItem[] = [{
    examId: "e1",
    title: "Matma",
    examDate: "2026-09-09",
    totalMinutes: 60,
    roiScore: 1,
  }];

  assertEquals(collectExamAlerts(exams, "2026-09-02")[0]?.kind, "t7");
  assertEquals(collectExamAlerts(exams, "2026-09-06")[0]?.kind, "t3");
  assertEquals(collectExamAlerts(exams, "2026-09-08")[0]?.kind, "t1");
});

Deno.test("mergeStudyItems respektuje budżet minut", () => {
  const items = mergeStudyItems(
    [{
      key: "a",
      title: "A",
      minutes: 30,
      priority: 10,
      source: "exam",
    }, {
      key: "b",
      title: "B",
      minutes: 40,
      priority: 5,
      source: "task",
    }],
    [],
    50,
  );
  assertEquals(items.length, 2);
  assertEquals(items[0].minutes + items[1].minutes, 50);
});

Deno.test("examsFromCalendar wyciąga sprawdziany", () => {
  const exams = examsFromCalendar([{
    id: "ev-1",
    title: "Sprawdzian Chemia",
    kind: "exam",
    start: "2026-09-12T08:00:00+02:00",
    source: "librus",
  }]);
  assertEquals(exams.length, 1);
  assertEquals(exams[0].examDate, "2026-09-12");
});

Deno.test("assignBlocksToSlots rozkłada bloki w slotach", () => {
  const blocks = assignBlocksToSlots("2026-09-02", [{
    start: "17:00",
    end: "19:00",
    minutes: 120,
  }], [{
    key: "1",
    title: "Chemia",
    minutes: 25,
    priority: 5,
    source: "exam",
  }, {
    key: "2",
    title: "Matma",
    minutes: 20,
    priority: 4,
    source: "task",
  }]);

  assertEquals(blocks.length, 2);
  assertEquals(blocks[0].start, "17:00");
  assertEquals(blocks[0].minutes, 25);
});
