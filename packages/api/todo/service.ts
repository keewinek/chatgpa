import { and, eq, isNull, lte } from "drizzle-orm";
import type { Task, TaskPriority, TaskSource, TaskStatus } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { tasks } from "../db/schema.ts";
import { FsError, fsRead, fsWrite } from "../fs/service.ts";
import { newTaskId, parseTodoFile, serializeTodoFile } from "./parser.ts";

export const GLOBAL_TODO_PATH = "~/todo/global.todo";

function rowToTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    title: row.title,
    subjectId: row.subjectId ?? undefined,
    dueDate: row.dueDate ?? undefined,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    estimatedMinutes: row.estimatedMinutes ?? undefined,
    source: row.source as TaskSource,
    roiScore: row.roiScore ?? undefined,
    scheduledFor: row.scheduledFor ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface ListTasksOptions {
  status?: TaskStatus;
  dueBefore?: string;
  scheduledFor?: string;
}

/** DB-only query — used by sync so we don't re-import mid-write. */
async function queryTasks(
  db: AppDatabase,
  options: ListTasksOptions = {},
): Promise<Task[]> {
  const conditions = [isNull(tasks.deletedAt)];
  if (options.status) conditions.push(eq(tasks.status, options.status));
  if (options.dueBefore) conditions.push(lte(tasks.dueDate, options.dueBefore));
  if (options.scheduledFor) conditions.push(eq(tasks.scheduledFor, options.scheduledFor));

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions));

  return rows
    .map(rowToTask)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const p = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (p !== 0) return p;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
}

async function readTodoFileContent(db: AppDatabase): Promise<string> {
  try {
    const file = await fsRead(db, GLOBAL_TODO_PATH, 0, 1_000_000);
    return file.content;
  } catch (err) {
    if (err instanceof FsError && err.status === 404) return "";
    throw err;
  }
}

/**
 * File is source of truth: sync `tasks` table to match ~/todo/global.todo.
 */
export async function importTodoFromFile(db: AppDatabase): Promise<number> {
  const content = await readTodoFileContent(db);
  const { tasks: fromFile } = parseTodoFile(content);
  const now = new Date().toISOString();

  const dbRows = await db
    .select()
    .from(tasks)
    .where(isNull(tasks.deletedAt));

  const fileById = new Map(fromFile.map((t) => [t.id, t]));

  for (const row of dbRows) {
    if (!fileById.has(row.id)) {
      await db
        .update(tasks)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(tasks.id, row.id));
    }
  }

  const active = await db
    .select()
    .from(tasks)
    .where(isNull(tasks.deletedAt));
  const byId = new Map(active.map((r) => [r.id, r]));

  let changed = 0;
  for (const task of fromFile) {
    const existing = byId.get(task.id);
    if (!existing) {
      await db.insert(tasks).values({
        id: task.id,
        title: task.title,
        subjectId: task.subjectId ?? null,
        dueDate: task.dueDate ?? null,
        priority: task.priority,
        status: task.status,
        estimatedMinutes: task.estimatedMinutes ?? null,
        source: task.source,
        roiScore: task.roiScore ?? null,
        scheduledFor: task.scheduledFor ?? null,
        notes: task.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
      changed++;
      continue;
    }

    const needsUpdate = existing.title !== task.title ||
      (existing.subjectId ?? undefined) !== task.subjectId ||
      (existing.dueDate ?? undefined) !== task.dueDate ||
      existing.priority !== task.priority ||
      existing.status !== task.status ||
      (existing.estimatedMinutes ?? undefined) !== task.estimatedMinutes ||
      existing.source !== task.source ||
      (existing.roiScore ?? undefined) !== task.roiScore ||
      (existing.scheduledFor ?? undefined) !== task.scheduledFor ||
      (existing.notes ?? undefined) !== task.notes;

    if (needsUpdate) {
      await db
        .update(tasks)
        .set({
          title: task.title,
          subjectId: task.subjectId ?? null,
          dueDate: task.dueDate ?? null,
          priority: task.priority,
          status: task.status,
          estimatedMinutes: task.estimatedMinutes ?? null,
          source: task.source,
          roiScore: task.roiScore ?? null,
          scheduledFor: task.scheduledFor ?? null,
          notes: task.notes ?? null,
          updatedAt: now,
          deletedAt: null,
        })
        .where(eq(tasks.id, task.id));
      changed++;
    }
  }

  return changed;
}

/** @deprecated Use importTodoFromFile — kept for callers that pass content. */
export async function importFromTodoFile(db: AppDatabase, content: string): Promise<number> {
  await fsWrite(db, GLOBAL_TODO_PATH, content);
  return await importTodoFromFile(db);
}

export async function listTasks(
  db: AppDatabase,
  options: ListTasksOptions = {},
): Promise<Task[]> {
  await importTodoFromFile(db);
  return queryTasks(db, options);
}

export interface AddTaskInput {
  title: string;
  subjectId?: string;
  dueDate?: string;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  source?: TaskSource;
  roiScore?: number;
  scheduledFor?: string;
  notes?: string;
}

export async function addTask(db: AppDatabase, input: AddTaskInput): Promise<Task> {
  const title = input.title.trim();
  if (!title) throw new Error("Tytuł zadania nie może być pusty");

  // Pick up file edits before adding, so we don't clobber them on sync.
  await importTodoFromFile(db);

  const now = new Date().toISOString();
  const task: Task = {
    id: newTaskId(),
    title,
    subjectId: input.subjectId,
    dueDate: input.dueDate,
    priority: input.priority ?? "medium",
    status: "open",
    estimatedMinutes: input.estimatedMinutes,
    source: input.source ?? "manual",
    roiScore: input.roiScore,
    scheduledFor: input.scheduledFor,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tasks).values({
    id: task.id,
    title: task.title,
    subjectId: task.subjectId ?? null,
    dueDate: task.dueDate ?? null,
    priority: task.priority,
    status: task.status,
    estimatedMinutes: task.estimatedMinutes ?? null,
    source: task.source,
    roiScore: task.roiScore ?? null,
    scheduledFor: task.scheduledFor ?? null,
    notes: task.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await syncGlobalTodoFile(db);
  return task;
}

export interface UpdateTaskInput {
  title?: string;
  subjectId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  estimatedMinutes?: number | null;
  source?: TaskSource;
  roiScore?: number | null;
  scheduledFor?: string | null;
  notes?: string | null;
}

export async function updateTask(
  db: AppDatabase,
  id: string,
  patch: UpdateTaskInput,
): Promise<Task | null> {
  await importTodoFromFile(db);
  const current = (await queryTasks(db)).find((t) => t.id === id);
  if (!current) return null;

  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({
      title: patch.title?.trim() ?? current.title,
      subjectId: patch.subjectId !== undefined ? patch.subjectId : current.subjectId ?? null,
      dueDate: patch.dueDate !== undefined ? patch.dueDate : current.dueDate ?? null,
      priority: patch.priority ?? current.priority,
      status: patch.status ?? current.status,
      estimatedMinutes: patch.estimatedMinutes !== undefined
        ? patch.estimatedMinutes
        : current.estimatedMinutes ?? null,
      source: patch.source ?? current.source,
      roiScore: patch.roiScore !== undefined ? patch.roiScore : current.roiScore ?? null,
      scheduledFor: patch.scheduledFor !== undefined
        ? patch.scheduledFor
        : current.scheduledFor ?? null,
      notes: patch.notes !== undefined ? patch.notes : current.notes ?? null,
      updatedAt: now,
    })
    .where(eq(tasks.id, id));

  await syncGlobalTodoFile(db);
  return (await queryTasks(db)).find((t) => t.id === id) ?? null;
}

export async function completeTask(db: AppDatabase, id: string): Promise<Task | null> {
  return await updateTask(db, id, { status: "done" });
}

export async function deleteTask(db: AppDatabase, id: string): Promise<Task | null> {
  await importTodoFromFile(db);
  const current = (await queryTasks(db)).find((t) => t.id === id);
  if (!current) return null;

  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(tasks.id, id));

  await syncGlobalTodoFile(db);
  return current;
}

/** Write DB tasks out to the file (after API mutations). Does not re-import. */
export async function syncGlobalTodoFile(db: AppDatabase): Promise<void> {
  const all = await queryTasks(db);
  const content = serializeTodoFile(all);
  await fsWrite(db, GLOBAL_TODO_PATH, content);
}

export function formatTaskLine(task: Task, index: number): string {
  const statusLabel = task.status === "done" ? "✓" : task.status === "cancelled" ? "✗" : "○";
  const due = task.dueDate ? `, termin: ${task.dueDate}` : "";
  const scheduled = task.scheduledFor ? `, zaplanowane: ${task.scheduledFor}` : "";
  const mins = task.estimatedMinutes ? `, ${task.estimatedMinutes} min` : "";
  const pri = task.priority !== "medium" ? `, priorytet: ${task.priority}` : "";
  return `${index + 1}. [${statusLabel}] ${task.title} [${task.id}]${due}${scheduled}${mins}${pri}`;
}
