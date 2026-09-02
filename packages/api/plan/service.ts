import type { CalEvent, Task, TimeSlot } from "@chatgpa/core";
import {
  formatMinutesToTime,
  parseTimeToMinutes,
  WEEKDAY_LABELS,
  weekdayFromDate,
} from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import {
  addEvent,
  computeFreeSlots,
  deleteEvent,
  listEvents,
  readMonth,
} from "../calendar/service.ts";
import { ensureFsSeeded } from "../fs/seed.ts";
import { fsWrite } from "../fs/service.ts";
import { listMemory } from "../memory/service.ts";
import { addTask, listTasks, updateTask } from "../todo/service.ts";
import { generatePlanMessage } from "./ai.ts";
import {
  addDaysIso,
  collectExamAlerts,
  daysBetween,
  distributeExamPrep,
  mergeStudyItems,
} from "./distribute.ts";
import type { DailyPlanResult, DayStudyItem, ExamPrepItem, PlanBlock } from "./types.ts";

export const PLANS_VIRTUAL_ROOT = "~/plans";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class PlanError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlanError";
  }
}

function planFilePath(date: string): string {
  return `${PLANS_VIRTUAL_ROOT}/${date}.plan`;
}

function weekdayLabel(date: string): string {
  const weekday = weekdayFromDate(new Date(`${date}T12:00:00`));
  return weekday ? WEEKDAY_LABELS[weekday] : "dzień wolny";
}

function examSubjectFromTitle(title: string): string | undefined {
  const match = title.match(/^Sprawdzian\s+(.+)$/i) ?? title.match(/^(.+?)\s*[-–:]/);
  return match?.[1]?.trim();
}

function defaultExamMinutes(daysUntil: number): number {
  if (daysUntil <= 3) return 120;
  if (daysUntil <= 7) return 90;
  return 60;
}

export function examsFromCalendar(events: CalEvent[]): ExamPrepItem[] {
  return events
    .filter((e) => e.kind === "exam")
    .map((e) => ({
      examId: e.id,
      title: e.title.replace(/^Sprawdzian\s*/i, "").trim() || e.title,
      subjectId: examSubjectFromTitle(e.title),
      examDate: e.start.slice(0, 10),
      totalMinutes: 90,
      roiScore: 1,
    }));
}

export function taskToStudyItem(task: Task, targetDate: string): DayStudyItem {
  const daysUntil = task.dueDate ? daysBetween(targetDate, task.dueDate) : 99;
  const urgency = daysUntil <= 0 ? 10 : Math.max(0, 8 - daysUntil);
  const priority = (task.roiScore ?? 1) * 5 +
    urgency +
    (task.priority === "high" ? 3 : task.priority === "low" ? -1 : 0);

  return {
    key: `task:${task.id}`,
    title: task.title,
    subjectId: task.subjectId,
    minutes: task.estimatedMinutes ?? 25,
    priority,
    examDate: task.dueDate,
    daysUntilExam: task.dueDate ? daysUntil : undefined,
    taskId: task.id,
    source: "task",
  };
}

export function assignBlocksToSlots(
  _date: string,
  slots: TimeSlot[],
  items: DayStudyItem[],
): PlanBlock[] {
  if (!slots.length || !items.length) return [];

  const blocks: PlanBlock[] = [];
  let slotIdx = 0;
  let cursor = parseTimeToMinutes(slots[0].start);
  const breakMinutes = 5;

  for (const item of items) {
    let remaining = item.minutes;

    while (remaining > 0 && slotIdx < slots.length) {
      const slot = slots[slotIdx];
      const slotEnd = parseTimeToMinutes(slot.end);

      if (cursor >= slotEnd) {
        slotIdx++;
        if (slotIdx >= slots.length) break;
        cursor = parseTimeToMinutes(slots[slotIdx].start);
        continue;
      }

      const available = slotEnd - cursor;
      const chunk = Math.min(remaining, available);
      if (chunk < 10) {
        slotIdx++;
        if (slotIdx >= slots.length) break;
        cursor = parseTimeToMinutes(slots[slotIdx].start);
        continue;
      }

      blocks.push({
        start: formatMinutesToTime(cursor),
        end: formatMinutesToTime(cursor + chunk),
        minutes: chunk,
        title: item.title,
        subjectId: item.subjectId,
        taskId: item.taskId,
        examDate: item.examDate,
        daysUntilExam: item.daysUntilExam,
        alertKind: item.alertKind,
      });

      remaining -= chunk;
      cursor += chunk + breakMinutes;
    }
  }

  return blocks;
}

export function formatPlanMarkdown(plan: DailyPlanResult): string {
  const lines = [
    `# Plan — ${plan.date} (${plan.weekdayLabel})`,
    "",
    `Budżet: ${plan.usedMinutes} / ${plan.budgetMinutes} min nauki`,
    "",
    "## Bloki",
  ];

  if (!plan.blocks.length) {
    lines.push("_Brak zaplanowanych bloków._");
  } else {
    plan.blocks.forEach((block, i) => {
      const roi = block.daysUntilExam ? ` (ROI: sprawdzian za ${block.daysUntilExam} dni)` : "";
      lines.push(
        `${i + 1}. ${block.start}–${block.end} (${block.minutes} min) — ${block.title}${roi}`,
      );
    });
  }

  if (plan.notes.length) {
    lines.push("", "## Uwagi");
    for (const note of plan.notes) lines.push(`- ${note}`);
  }

  if (plan.examAlerts.length) {
    lines.push("", "## Alerty sprawdzianowe");
    for (const alert of plan.examAlerts) {
      lines.push(`- T-${alert.daysUntil}: ${alert.title}`);
    }
  }

  lines.push("", "## Wiadomość agenta", "", plan.message, "");
  return lines.join("\n");
}

async function removeStudyBlocksForDate(db: AppDatabase, date: string): Promise<void> {
  const month = date.slice(0, 7);
  const data = await readMonth(db, month);
  const toRemove = data.events.filter(
    (e) => e.kind === "study_block" && e.source === "ai" && e.start.startsWith(date),
  );
  if (!toRemove.length) return;

  for (const event of toRemove) {
    await deleteEvent(db, event.id);
  }
}

async function ensurePlanTasks(
  db: AppDatabase,
  date: string,
  items: DayStudyItem[],
): Promise<Task[]> {
  const scheduled = await listTasks(db, { status: "open", scheduledFor: date });
  const byKey = new Map<string, Task>();

  for (const task of scheduled) byKey.set(`task:${task.id}`, task);

  for (const item of items) {
    if (item.taskId) {
      const existing = scheduled.find((t) => t.id === item.taskId);
      if (existing) {
        await updateTask(db, existing.id, {
          scheduledFor: date,
          estimatedMinutes: item.minutes,
          source: "plan",
        });
        byKey.set(`task:${existing.id}`, {
          ...existing,
          scheduledFor: date,
          estimatedMinutes: item.minutes,
          source: "plan",
        });
      }
      continue;
    }

    const title = item.title;
    const duplicate = scheduled.find((t) =>
      t.title === title && t.source === "plan" && t.scheduledFor === date
    );
    if (duplicate) {
      await updateTask(db, duplicate.id, { estimatedMinutes: item.minutes });
      byKey.set(`task:${duplicate.id}`, { ...duplicate, estimatedMinutes: item.minutes });
      continue;
    }

    const created = await addTask(db, {
      title,
      subjectId: item.subjectId,
      dueDate: item.examDate,
      estimatedMinutes: item.minutes,
      source: "plan",
      scheduledFor: date,
      priority: item.alertKind === "t1" ? "high" : item.alertKind === "t3" ? "high" : "medium",
      notes: item.daysUntilExam ? `sprawdzian za ${item.daysUntilExam} dni` : undefined,
    });
    byKey.set(`task:${created.id}`, created);
  }

  return [...byKey.values()];
}

async function writeStudyBlocks(db: AppDatabase, date: string, blocks: PlanBlock[]): Promise<void> {
  await removeStudyBlocksForDate(db, date);

  for (const block of blocks) {
    await addEvent(db, {
      title: block.title,
      kind: "study_block",
      start: `${date}T${block.start}:00+02:00`,
      end: `${date}T${block.end}:00+02:00`,
      source: "ai",
    });
  }
}

export async function generateDailyPlan(
  db: AppDatabase,
  date: string,
): Promise<DailyPlanResult> {
  if (!DATE_RE.test(date)) throw new PlanError("Data musi być w formacie YYYY-MM-DD", 400);

  await ensureFsSeeded(db);

  const horizonEnd = addDaysIso(date, 14);
  const events = await listEvents(db, date, horizonEnd);
  const exams = examsFromCalendar(events);

  for (const exam of exams) {
    const daysUntil = daysBetween(date, exam.examDate);
    exam.totalMinutes = defaultExamMinutes(daysUntil);
    exam.roiScore = daysUntil <= 3 ? 2 : daysUntil <= 7 ? 1.5 : 1;
  }

  const freeSlots = await computeFreeSlots(db, date);
  const examItems = distributeExamPrep(exams, date);
  const examAlerts = collectExamAlerts(exams, date);

  const openTasks = await listTasks(db, { status: "open" });
  const taskItems: DayStudyItem[] = [];

  for (const task of openTasks) {
    if (task.scheduledFor === date) {
      taskItems.push(taskToStudyItem(task, date));
      continue;
    }
    if (task.scheduledFor && task.scheduledFor !== date) continue;
    if (task.dueDate && task.dueDate <= addDaysIso(date, 3)) {
      taskItems.push(taskToStudyItem(task, date));
    }
  }

  const budgetMinutes = Math.max(freeSlots.freeMinutes, 30);
  const selectedItems = mergeStudyItems(examItems, taskItems, budgetMinutes);
  const blocks = assignBlocksToSlots(date, freeSlots.slots, selectedItems);
  const usedMinutes = blocks.reduce((s, b) => s + b.minutes, 0);

  const { message, notes, aiUsed } = await generatePlanMessage({
    date,
    weekdayLabel: weekdayLabel(date),
    freeSlots,
    items: selectedItems,
    examAlerts,
    blocks,
  });

  const planTasks = await ensurePlanTasks(db, date, selectedItems);
  await writeStudyBlocks(db, date, blocks);

  const result: DailyPlanResult = {
    date,
    weekdayLabel: weekdayLabel(date),
    budgetMinutes: freeSlots.freeMinutes,
    usedMinutes,
    blocks,
    tasks: planTasks,
    message,
    notes,
    examAlerts,
    planFilePath: planFilePath(date),
    aiUsed,
  };

  await fsWrite(db, planFilePath(date), formatPlanMarkdown(result));
  return result;
}

export async function readPlanFile(db: AppDatabase, date: string): Promise<string | null> {
  try {
    const { fsRead } = await import("../fs/service.ts");
    const file = await fsRead(db, planFilePath(date));
    return file.content;
  } catch {
    return null;
  }
}

export async function buildPlanContextSummary(db: AppDatabase, date: string): Promise<string> {
  const freeSlots = await computeFreeSlots(db, date);
  const tasks = await listTasks(db, { status: "open", scheduledFor: date });
  const events = await listEvents(db, date, addDaysIso(date, 7));
  const memory = await listMemory(db, { kind: "long" });

  const lines = [
    `Plan na ${date}`,
    `Wolne minuty: ${freeSlots.freeMinutes}`,
    `TODO na dziś: ${tasks.length}`,
    `Wydarzenia (7 dni): ${events.length}`,
    `Preferencje (long memory): ${memory.length} wpisów`,
  ];
  return lines.join("\n");
}
