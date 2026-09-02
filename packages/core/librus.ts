import type { Task } from "./types.ts";
import type { CalEvent } from "./calendar.ts";
import type { Weekday } from "./timetable.ts";

export interface LibrusGrade {
  id: string;
  subjectId?: string;
  subjectName: string;
  value: number | string;
  weight?: number;
  category?: string;
  date?: string;
  comment?: string;
}

export interface LibrusSubject {
  id?: string;
  name: string;
  average?: number;
  grades: LibrusGrade[];
}

export interface LibrusScheduleLesson {
  slot: number;
  subject: string;
  teacher?: string;
  room?: string;
  group?: number;
}

export type LibrusScheduleDay = Partial<Record<Weekday, LibrusScheduleLesson[]>>;

export interface LibrusSchedule {
  syncedAt?: string;
  className?: string;
  source?: "librus" | "static";
  days: LibrusScheduleDay;
}

export interface TimetableChange {
  id: string;
  date: string;
  description: string;
  details?: string;
  detectedAt?: string;
}

export interface TimetableChangesSnapshot {
  syncedAt?: string;
  changes: TimetableChange[];
}

export interface GradesSnapshot {
  syncedAt?: string;
  subjects: LibrusSubject[];
}

export interface LibrusSyncPayload {
  syncedAt: string;
  grades?: LibrusGrade[];
  subjects?: LibrusSubject[];
  exams?: CalEvent[];
  homeworks?: Task[];
  schedule?: LibrusSchedule;
  timetableChanges?: TimetableChange[];
}

export interface LibrusMergeDiff {
  newGrades: number;
  updatedGrades: number;
  removedGrades: number;
  newExams: number;
  updatedExams: number;
  newHomeworks: number;
  updatedHomeworks: number;
  scheduleChanged: boolean;
  newTimetableChanges: number;
  notes: string[];
}

export interface LibrusSyncResult {
  ok: true;
  syncedAt: string;
  counts: {
    grades: number;
    exams: number;
    homeworks: number;
    scheduleLessons: number;
    timetableChanges: number;
  };
  merge: LibrusMergeDiff;
  stale: boolean;
}

export interface LibrusStatus {
  syncedAt: string | null;
  stale: boolean;
  counts: {
    grades: number;
    exams: number;
    homeworks: number;
    timetableChanges: number;
  };
}

export function librusEventKey(event: Pick<CalEvent, "title" | "kind" | "start">): string {
  return `${event.kind}:${event.start.slice(0, 10)}:${event.title.toLowerCase().trim()}`;
}

export function librusGradeKey(
  grade: Pick<LibrusGrade, "subjectName" | "value" | "date" | "category">,
): string {
  return [
    grade.subjectName.toLowerCase().trim(),
    String(grade.value),
    grade.date ?? "",
    grade.category ?? "",
  ].join("|");
}

export function isLibrusStale(syncedAt: string | null | undefined, now = Date.now()): boolean {
  if (!syncedAt) return true;
  const ageMs = now - new Date(syncedAt).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}
