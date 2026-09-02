import type { DayStudyItem, ExamAlert, ExamPrepItem } from "./types.ts";

const WARSAW_TZ = "Europe/Warsaw";

export function formatWarsawIsoDate(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: WARSAW_TZ }).format(date);
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function studyDayWeight(daysUntil: number): number {
  if (daysUntil <= 0) return 0;
  if (daysUntil === 1) return 1.2;
  if (daysUntil <= 3) return 1.5;
  if (daysUntil <= 7) return 1.0;
  return 0;
}

function chunkMinutesForDay(daysUntil: number, share: number): number {
  if (daysUntil === 1) return Math.max(20, Math.min(45, Math.round(share)));
  if (daysUntil <= 3) return Math.max(25, Math.min(50, Math.round(share)));
  return Math.max(15, Math.min(25, Math.round(share)));
}

function alertKindForDays(daysUntil: number): "t7" | "t3" | "t1" | undefined {
  if (daysUntil === 7) return "t7";
  if (daysUntil === 3) return "t3";
  if (daysUntil === 1) return "t1";
  return undefined;
}

/** Rozkład nauki przed sprawdzianem od T-7 (małe porcje wcześniej, większe bliżej terminu). */
export function distributeExamPrep(
  exams: ExamPrepItem[],
  targetDate: string,
  horizonDays = 14,
): DayStudyItem[] {
  const items: DayStudyItem[] = [];

  for (const exam of exams) {
    const daysUntil = daysBetween(targetDate, exam.examDate);
    if (daysUntil < 1 || daysUntil > horizonDays) continue;

    const studyStart = addDaysIso(exam.examDate, -7);
    if (targetDate < studyStart || targetDate >= exam.examDate) continue;

    const weights: Array<{ date: string; weight: number }> = [];
    for (let d = 1; d <= 7; d++) {
      const date = addDaysIso(exam.examDate, -d);
      const w = studyDayWeight(d);
      if (w > 0) weights.push({ date, weight: w });
    }

    const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
    const dayWeight = studyDayWeight(daysUntil);
    if (dayWeight <= 0 || totalWeight <= 0) continue;

    const share = (exam.totalMinutes * dayWeight) / totalWeight;
    const minutes = chunkMinutesForDay(daysUntil, share);
    const alertKind = alertKindForDays(daysUntil);

    items.push({
      key: `exam:${exam.examId}:${targetDate}`,
      title: `Powtórka: ${exam.title}`,
      subjectId: exam.subjectId,
      minutes,
      priority: exam.roiScore * 10 + (8 - daysUntil),
      examDate: exam.examDate,
      daysUntilExam: daysUntil,
      alertKind,
      source: "exam",
    });
  }

  return items;
}

export function collectExamAlerts(exams: ExamPrepItem[], targetDate: string): ExamAlert[] {
  const alerts: ExamAlert[] = [];
  for (const exam of exams) {
    const daysUntil = daysBetween(targetDate, exam.examDate);
    const kind = alertKindForDays(daysUntil);
    if (!kind) continue;
    alerts.push({
      kind,
      examDate: exam.examDate,
      title: exam.title,
      subjectId: exam.subjectId,
      daysUntil,
    });
  }
  return alerts;
}

export function mergeStudyItems(
  examItems: DayStudyItem[],
  taskItems: DayStudyItem[],
  budgetMinutes: number,
): DayStudyItem[] {
  const merged = [...examItems, ...taskItems].sort((a, b) => b.priority - a.priority);
  const selected: DayStudyItem[] = [];
  let used = 0;

  for (const item of merged) {
    if (used + item.minutes > budgetMinutes) {
      const remaining = budgetMinutes - used;
      if (remaining >= 15) {
        selected.push({ ...item, minutes: remaining });
        used = budgetMinutes;
      }
      break;
    }
    selected.push(item);
    used += item.minutes;
  }

  return selected;
}
