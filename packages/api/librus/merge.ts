import type { CalEvent } from "@chatgpa/core";
import type { Task } from "@chatgpa/core";
import {
  type GradesSnapshot,
  librusEventKey,
  type LibrusGrade,
  librusGradeKey,
  type LibrusMergeDiff,
  type LibrusSchedule,
  type LibrusSubject,
  type LibrusSyncPayload,
  type TimetableChange,
  type TimetableChangesSnapshot,
} from "@chatgpa/core";
import { newEventId } from "@chatgpa/core";

export const LIBRUS_PATHS = {
  grades: "~/school/librus/grades.json",
  schedule: "~/school/librus/schedule.json",
  timetableChanges: "~/school/librus/timetable-changes.json",
  syncMeta: "~/school/librus/sync-meta.json",
} as const;

function groupGradesIntoSubjects(
  grades: LibrusGrade[],
  existingSubjects: LibrusSubject[] = [],
): LibrusSubject[] {
  const byName = new Map<string, LibrusSubject>();

  for (const subject of existingSubjects) {
    byName.set(subject.name.toLowerCase(), { ...subject, grades: [...subject.grades] });
  }

  for (const grade of grades) {
    const key = grade.subjectName.toLowerCase();
    let subject = byName.get(key);
    if (!subject) {
      subject = { name: grade.subjectName, grades: [] };
      byName.set(key, subject);
    }
    const gradeKey = librusGradeKey(grade);
    const idx = subject.grades.findIndex((g) => librusGradeKey(g) === gradeKey);
    const entry: LibrusGrade = { ...grade, id: grade.id || `grade-${gradeKey}` };
    if (idx === -1) subject.grades.push(entry);
    else subject.grades[idx] = { ...subject.grades[idx], ...entry };
  }

  for (const subject of byName.values()) {
    const nums = subject.grades
      .map((g) => typeof g.value === "number" ? g.value : parseFloat(String(g.value)))
      .filter((n) => !Number.isNaN(n));
    if (nums.length) {
      subject.average = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function mergeGradesSnapshot(
  existing: GradesSnapshot | null,
  payload: LibrusSyncPayload,
): {
  merged: GradesSnapshot;
  diff: Pick<LibrusMergeDiff, "newGrades" | "updatedGrades" | "removedGrades" | "notes">;
} {
  const notes: string[] = [];
  const incomingSubjects = payload.subjects?.length
    ? payload.subjects
    : payload.grades?.length
    ? groupGradesIntoSubjects(payload.grades, existing?.subjects ?? [])
    : null;

  if (!incomingSubjects) {
    return {
      merged: existing ?? { syncedAt: payload.syncedAt, subjects: [] },
      diff: { newGrades: 0, updatedGrades: 0, removedGrades: 0, notes },
    };
  }

  const oldKeys = new Set<string>();
  for (const subject of existing?.subjects ?? []) {
    for (const grade of subject.grades) {
      oldKeys.add(librusGradeKey(grade));
    }
  }

  const mergedSubjects = groupGradesIntoSubjects(
    incomingSubjects.flatMap((s) =>
      s.grades.map((g) => ({ ...g, subjectName: g.subjectName || s.name }))
    ),
    existing?.subjects ?? [],
  );

  const newKeys = new Set<string>();
  let updatedGrades = 0;
  for (const subject of mergedSubjects) {
    for (const grade of subject.grades) {
      const key = librusGradeKey(grade);
      newKeys.add(key);
      if (oldKeys.has(key)) {
        const oldGrade = (existing?.subjects ?? [])
          .flatMap((s) => s.grades)
          .find((g) => librusGradeKey(g) === key);
        if (oldGrade && JSON.stringify(oldGrade) !== JSON.stringify(grade)) {
          updatedGrades++;
        }
      }
    }
  }

  const newGrades = [...newKeys].filter((k) => !oldKeys.has(k)).length;
  const removedGrades = [...oldKeys].filter((k) => !newKeys.has(k)).length;

  if (newGrades) notes.push(`${newGrades} nowych ocen`);
  if (updatedGrades) notes.push(`${updatedGrades} zaktualizowanych ocen`);
  if (removedGrades) {
    notes.push(`${removedGrades} ocen zniknęło ze snapshotu (zachowane w historii merge)`);
  }

  return {
    merged: { syncedAt: payload.syncedAt, subjects: mergedSubjects },
    diff: { newGrades, updatedGrades, removedGrades, notes },
  };
}

function scheduleFingerprint(schedule: LibrusSchedule | null | undefined): string {
  if (!schedule?.days) return "";
  return JSON.stringify(schedule.days);
}

export function mergeScheduleSnapshot(
  existing: LibrusSchedule | null,
  incoming: LibrusSchedule | undefined,
  syncedAt: string,
): { merged: LibrusSchedule | null; scheduleChanged: boolean; notes: string[] } {
  if (!incoming?.days || !Object.keys(incoming.days).length) {
    return { merged: existing, scheduleChanged: false, notes: [] };
  }

  const notes: string[] = [];
  const oldFp = scheduleFingerprint(existing);
  const newFp = scheduleFingerprint(incoming);
  const scheduleChanged = oldFp !== "" && oldFp !== newFp;

  if (scheduleChanged) notes.push("Wykryto zmianę planu lekcji w Librus");

  const merged: LibrusSchedule = {
    ...existing,
    ...incoming,
    syncedAt,
    source: "librus",
    days: incoming.days,
  };

  return { merged, scheduleChanged, notes };
}

export function mergeTimetableChanges(
  existing: TimetableChangesSnapshot | null,
  incoming: TimetableChange[] | undefined,
  syncedAt: string,
): { merged: TimetableChangesSnapshot; newTimetableChanges: number; notes: string[] } {
  const notes: string[] = [];
  const seen = new Set((existing?.changes ?? []).map((c) => c.id));
  const merged = [...(existing?.changes ?? [])];

  let newTimetableChanges = 0;
  for (const change of incoming ?? []) {
    const id = change.id || `change-${change.date}-${change.description.slice(0, 32)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push({ ...change, id, detectedAt: change.detectedAt ?? syncedAt });
    newTimetableChanges++;
  }

  merged.sort((a, b) => b.date.localeCompare(a.date));

  if (newTimetableChanges) notes.push(`${newTimetableChanges} nowych zmian planu`);

  return {
    merged: { syncedAt, changes: merged },
    newTimetableChanges,
    notes,
  };
}

export function mergeCalendarEvents(
  existingEvents: CalEvent[],
  incomingExams: CalEvent[] = [],
  incomingHomeworks: Task[] = [],
): {
  events: CalEvent[];
  diff: Pick<
    LibrusMergeDiff,
    "newExams" | "updatedExams" | "newHomeworks" | "updatedHomeworks" | "notes"
  >;
} {
  const notes: string[] = [];
  const preserved = existingEvents.filter((e) => e.source !== "librus");
  const oldLibrus = existingEvents.filter((e) => e.source === "librus");
  const oldByKey = new Map(oldLibrus.map((e) => [librusEventKey(e), e]));

  let newExams = 0;
  let updatedExams = 0;
  let newHomeworks = 0;
  let updatedHomeworks = 0;

  const mergedLibrus: CalEvent[] = [];

  for (const exam of incomingExams) {
    const event: CalEvent = {
      id: exam.id || newEventId(),
      title: exam.title,
      kind: exam.kind === "homework" ? "homework" : "exam",
      start: exam.start,
      end: exam.end,
      source: "librus",
    };
    const key = librusEventKey(event);
    const prev = oldByKey.get(key);
    if (!prev) {
      newExams++;
      mergedLibrus.push(event);
    } else {
      if (JSON.stringify(prev) !== JSON.stringify({ ...prev, ...event, id: prev.id })) {
        updatedExams++;
      }
      mergedLibrus.push({ ...prev, ...event, id: prev.id });
      oldByKey.delete(key);
    }
  }

  for (const hw of incomingHomeworks) {
    const start = hw.dueDate ? `${hw.dueDate}T23:59:00+02:00` : new Date().toISOString();
    const event: CalEvent = {
      id: hw.id || newEventId(),
      title: hw.title,
      kind: "homework",
      start,
      source: "librus",
    };
    const key = librusEventKey(event);
    const prev = oldByKey.get(key);
    if (!prev) {
      newHomeworks++;
      mergedLibrus.push(event);
    } else {
      if (prev.title !== event.title) updatedHomeworks++;
      mergedLibrus.push({ ...prev, title: event.title, start: event.start, id: prev.id });
      oldByKey.delete(key);
    }
  }

  // Keep old librus events not in incoming (don't delete on sync absence)
  for (const leftover of oldByKey.values()) {
    mergedLibrus.push(leftover);
  }

  if (newExams) notes.push(`${newExams} nowych terminów sprawdzianów`);
  if (updatedExams) notes.push(`${updatedExams} zaktualizowanych terminów`);
  if (newHomeworks) notes.push(`${newHomeworks} nowych prac domowych w kalendarzu`);
  if (updatedHomeworks) notes.push(`${updatedHomeworks} zaktualizowanych prac domowych`);

  mergedLibrus.sort((a, b) => a.start.localeCompare(b.start));

  return {
    events: [...preserved, ...mergedLibrus],
    diff: { newExams, updatedExams, newHomeworks, updatedHomeworks, notes },
  };
}

export function buildMergeDiff(
  parts: Partial<LibrusMergeDiff> & { notes?: string[] },
): LibrusMergeDiff {
  return {
    newGrades: parts.newGrades ?? 0,
    updatedGrades: parts.updatedGrades ?? 0,
    removedGrades: parts.removedGrades ?? 0,
    newExams: parts.newExams ?? 0,
    updatedExams: parts.updatedExams ?? 0,
    newHomeworks: parts.newHomeworks ?? 0,
    updatedHomeworks: parts.updatedHomeworks ?? 0,
    scheduleChanged: parts.scheduleChanged ?? false,
    newTimetableChanges: parts.newTimetableChanges ?? 0,
    notes: parts.notes ?? [],
  };
}

export function countScheduleLessons(schedule: LibrusSchedule | null | undefined): number {
  if (!schedule?.days) return 0;
  return Object.values(schedule.days).reduce((sum, day) => sum + (day?.length ?? 0), 0);
}
