import type {
  GradesSnapshot,
  LibrusSchedule,
  LibrusStatus,
  LibrusSyncPayload,
  LibrusSyncResult,
  TimetableChangesSnapshot,
} from "@chatgpa/core";
import { isLibrusStale, monthFromDate } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { FsError, fsRead, fsWrite } from "../fs/service.ts";
import { rememberMemory } from "../memory/service.ts";
import { addTask, listTasks } from "../todo/service.ts";
import { listEvents, writeMonth } from "../calendar/service.ts";
import {
  buildMergeDiff,
  countScheduleLessons,
  LIBRUS_PATHS,
  mergeCalendarEvents,
  mergeGradesSnapshot,
  mergeScheduleSnapshot,
  mergeTimetableChanges,
} from "./merge.ts";

export class LibrusError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LibrusError";
  }
}

async function readJsonFile<T>(db: AppDatabase, path: string): Promise<T | null> {
  try {
    const file = await fsRead(db, path);
    return JSON.parse(file.content) as T;
  } catch (err) {
    if (err instanceof FsError && err.status === 404) return null;
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}

async function writeJsonFile(db: AppDatabase, path: string, data: unknown): Promise<void> {
  await fsWrite(db, path, JSON.stringify(data, null, 2) + "\n");
}

function validatePayload(body: LibrusSyncPayload): LibrusSyncPayload {
  if (!body.syncedAt || typeof body.syncedAt !== "string") {
    throw new LibrusError("Pole syncedAt jest wymagane (ISO datetime)", 400);
  }
  if (Number.isNaN(new Date(body.syncedAt).getTime())) {
    throw new LibrusError("Pole syncedAt ma nieprawidłowy format daty", 400);
  }
  return body;
}

function countGrades(snapshot: GradesSnapshot | null): number {
  return (snapshot?.subjects ?? []).reduce((sum, s) => sum + s.grades.length, 0);
}

export async function getLibrusStatus(db: AppDatabase): Promise<LibrusStatus> {
  const meta = await readJsonFile<{ syncedAt?: string; counts?: LibrusStatus["counts"] }>(
    db,
    LIBRUS_PATHS.syncMeta,
  );
  const grades = await readJsonFile<GradesSnapshot>(db, LIBRUS_PATHS.grades);
  const changes = await readJsonFile<TimetableChangesSnapshot>(db, LIBRUS_PATHS.timetableChanges);

  const syncedAt = meta?.syncedAt ?? grades?.syncedAt ?? null;

  return {
    syncedAt,
    stale: isLibrusStale(syncedAt),
    counts: meta?.counts ?? {
      grades: countGrades(grades),
      exams: 0,
      homeworks: 0,
      timetableChanges: changes?.changes?.length ?? 0,
    },
  };
}

export async function previewLibrusMerge(
  db: AppDatabase,
  payload: LibrusSyncPayload,
): Promise<{ merge: ReturnType<typeof buildMergeDiff> }> {
  const body = validatePayload(payload);
  const existingGrades = await readJsonFile<GradesSnapshot>(db, LIBRUS_PATHS.grades);
  const existingSchedule = await readJsonFile<LibrusSchedule>(db, LIBRUS_PATHS.schedule);
  const existingChanges = await readJsonFile<TimetableChangesSnapshot>(
    db,
    LIBRUS_PATHS.timetableChanges,
  );

  const gradesMerge = mergeGradesSnapshot(existingGrades, body);
  const scheduleMerge = mergeScheduleSnapshot(existingSchedule, body.schedule, body.syncedAt);
  const changesMerge = mergeTimetableChanges(
    existingChanges,
    body.timetableChanges,
    body.syncedAt,
  );

  const from = body.syncedAt.slice(0, 10);
  const toDate = new Date(body.syncedAt);
  toDate.setMonth(toDate.getMonth() + 3);
  const to = toDate.toISOString().slice(0, 10);
  const existingEvents = await listEvents(db, from, to);
  const calMerge = mergeCalendarEvents(existingEvents, body.exams ?? [], body.homeworks ?? []);

  const notes = [
    ...gradesMerge.diff.notes,
    ...scheduleMerge.notes,
    ...changesMerge.notes,
    ...calMerge.diff.notes,
  ];

  return {
    merge: buildMergeDiff({
      ...gradesMerge.diff,
      ...calMerge.diff,
      scheduleChanged: scheduleMerge.scheduleChanged,
      newTimetableChanges: changesMerge.newTimetableChanges,
      notes,
    }),
  };
}

export async function syncLibrus(
  db: AppDatabase,
  payload: LibrusSyncPayload,
): Promise<LibrusSyncResult> {
  const body = validatePayload(payload);

  const existingGrades = await readJsonFile<GradesSnapshot>(db, LIBRUS_PATHS.grades);
  const existingSchedule = await readJsonFile<LibrusSchedule>(db, LIBRUS_PATHS.schedule);
  const existingChanges = await readJsonFile<TimetableChangesSnapshot>(
    db,
    LIBRUS_PATHS.timetableChanges,
  );

  const gradesMerge = mergeGradesSnapshot(existingGrades, body);
  await writeJsonFile(db, LIBRUS_PATHS.grades, gradesMerge.merged);

  const scheduleMerge = mergeScheduleSnapshot(existingSchedule, body.schedule, body.syncedAt);
  if (scheduleMerge.merged) {
    await writeJsonFile(db, LIBRUS_PATHS.schedule, scheduleMerge.merged);
  }

  const changesMerge = mergeTimetableChanges(
    existingChanges,
    body.timetableChanges,
    body.syncedAt,
  );
  await writeJsonFile(db, LIBRUS_PATHS.timetableChanges, changesMerge.merged);

  const from = body.syncedAt.slice(0, 10);
  const toDate = new Date(body.syncedAt);
  toDate.setMonth(toDate.getMonth() + 6);
  const to = toDate.toISOString().slice(0, 10);
  const existingEvents = await listEvents(db, from, to);
  const calMerge = mergeCalendarEvents(existingEvents, body.exams ?? [], body.homeworks ?? []);

  const monthsTouched = new Set<string>();
  for (const event of calMerge.events) {
    monthsTouched.add(monthFromDate(event.start));
  }
  for (const event of existingEvents) {
    monthsTouched.add(monthFromDate(event.start));
  }

  for (const month of monthsTouched) {
    const monthEvents = calMerge.events.filter((e) => monthFromDate(e.start) === month);
    await writeMonth(db, { month, events: monthEvents });
  }

  let homeworksSynced = 0;
  if (body.homeworks?.length) {
    const existingTasks = await listTasks(db);
    const openLibrus = existingTasks.filter((t) => t.source === "librus" && t.status === "open");
    const byTitle = new Map(openLibrus.map((t) => [t.title.toLowerCase(), t]));

    for (const hw of body.homeworks) {
      const key = hw.title.toLowerCase();
      if (byTitle.has(key)) continue;
      await addTask(db, {
        title: hw.title,
        dueDate: hw.dueDate,
        priority: hw.priority ?? "medium",
        source: "librus",
        subjectId: hw.subjectId,
        estimatedMinutes: hw.estimatedMinutes,
      });
      homeworksSynced++;
    }
  }

  const merge = buildMergeDiff({
    ...gradesMerge.diff,
    ...calMerge.diff,
    scheduleChanged: scheduleMerge.scheduleChanged,
    newTimetableChanges: changesMerge.newTimetableChanges,
    notes: [
      ...gradesMerge.diff.notes,
      ...scheduleMerge.notes,
      ...changesMerge.notes,
      ...calMerge.diff.notes,
    ],
  });

  const counts = {
    grades: countGrades(gradesMerge.merged),
    exams: (body.exams ?? []).length,
    homeworks: homeworksSynced || (body.homeworks ?? []).length,
    scheduleLessons: countScheduleLessons(scheduleMerge.merged),
    timetableChanges: changesMerge.merged.changes.length,
  };

  await writeJsonFile(db, LIBRUS_PATHS.syncMeta, {
    syncedAt: body.syncedAt,
    counts: {
      grades: counts.grades,
      exams: counts.exams,
      homeworks: counts.homeworks,
      timetableChanges: counts.timetableChanges,
    },
    lastMerge: merge,
  });

  if (merge.notes.length) {
    await rememberMemory(db, {
      content: `Librus sync (${new Date(body.syncedAt).toLocaleString("pl-PL")}): ${
        merge.notes.join("; ")
      }`,
      kind: "short",
      source: "system",
      tags: ["librus", "sync"],
    });
  }

  if (scheduleMerge.scheduleChanged) {
    await rememberMemory(db, {
      content: "Librus: wykryto zmianę planu lekcji — sprawdź schedule.json i kalendarz.",
      kind: "short",
      source: "system",
      tags: ["librus", "schedule"],
    });
  }

  return {
    ok: true,
    syncedAt: body.syncedAt,
    counts,
    merge,
    stale: false,
  };
}
