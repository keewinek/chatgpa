import { and, eq, isNull, like, or } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { fileNodes } from "../db/schema.ts";
import { nodeIdForPath, USER_ROOT } from "./path.ts";

/** Default directory tree under ~/ (see ai-kontekst/system-plikow.md). */
export const SEED_DIRECTORIES = [
  "memory",
  "todo",
  "notes",
  "calendar",
  "books",
  "plans",
  "profile",
  "pomodoro",
  "school/librus",
] as const;

/** Seed `.ui` launchers — only calendar + timetable (rest is plain files). */
export const SEED_UI_SHORTCUTS = [
  { dir: "calendar", file: "calendar.ui", view: "calendar", title: "Kalendarz" },
  { dir: "school", file: "timetable.ui", view: "timetable", title: "Plan lekcji" },
] as const;

/** Removed from product — soft-delete if still present. */
const OBSOLETE_UI_PATHS = [
  "todo/todo.ui",
  "notes/notes.ui",
  "profile/profile.ui",
  "pomodoro/pomodoro.ui",
] as const;

/** Old Polish-capitalized shortcut dirs — replaced by lowercase SEED_DIRECTORIES. */
const LEGACY_CAPITALIZED_DIRS = [
  "Kalendarz",
  "Notatki",
  "Plan lekcji",
  "Pomodoro",
  "Profil",
  "TODO",
] as const;

/** Bump when seed/cleanup behavior changes so existing isolates re-run once. */
const SEED_VERSION = 3;

/** Per-DB gate so we don't re-seed / legacy-purge on every FS request. */
const seededDbs = new WeakMap<object, number>();

export function invalidateFsSeedCache(db?: AppDatabase): void {
  if (db) seededDbs.delete(db as object);
}

export async function isFsSeeded(db: AppDatabase): Promise<boolean> {
  const rows = await db
    .select({ id: fileNodes.id })
    .from(fileNodes)
    .where(eq(fileNodes.path, `${USER_ROOT}/memory`))
    .limit(1);
  return rows.length > 0;
}

async function ensureDirectory(db: AppDatabase, internalPath: string, now: string): Promise<void> {
  await db
    .insert(fileNodes)
    .values({
      id: nodeIdForPath(internalPath),
      path: internalPath,
      kind: "directory",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}

async function ensureFile(
  db: AppDatabase,
  internalPath: string,
  content: string,
  mimeType: string,
  now: string,
): Promise<void> {
  await db
    .insert(fileNodes)
    .values({
      id: nodeIdForPath(internalPath),
      path: internalPath,
      kind: "file",
      content,
      mimeType,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}

export async function seedFs(db: AppDatabase): Promise<void> {
  const now = new Date().toISOString();

  for (const rel of SEED_DIRECTORIES) {
    const segments = rel.split("/");
    let path = USER_ROOT;
    for (const segment of segments) {
      path = `${path}/${segment}`;
      await ensureDirectory(db, path, now);
    }
  }
}

/** Idempotent — creates missing UI shortcuts and groups.json. */
export async function seedUiShortcuts(db: AppDatabase): Promise<void> {
  const now = new Date().toISOString();

  for (const shortcut of SEED_UI_SHORTCUTS) {
    const dirPath = `${USER_ROOT}/${shortcut.dir}`;
    await ensureDirectory(db, dirPath, now);
    const filePath = `${dirPath}/${shortcut.file}`;
    const content = JSON.stringify(
      { view: shortcut.view, title: shortcut.title },
      null,
      2,
    ) + "\n";
    await ensureFile(db, filePath, content, "application/x-chatgpa-ui", now);
  }

  const schoolPath = `${USER_ROOT}/school`;
  await ensureDirectory(db, schoolPath, now);
  await ensureFile(
    db,
    `${schoolPath}/groups.json`,
    JSON.stringify(
      { language: 1, english: 1, pe: 1, informatics: 1 },
      null,
      2,
    ) + "\n",
    "application/json",
    now,
  );
}

/** Soft-delete leftover capitalized Polish dirs (and their .ui shortcuts). */
export async function removeLegacyCapitalizedDirs(db: AppDatabase): Promise<void> {
  const now = new Date().toISOString();
  for (const name of LEGACY_CAPITALIZED_DIRS) {
    const prefix = `${USER_ROOT}/${name}`;
    await db
      .update(fileNodes)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          isNull(fileNodes.deletedAt),
          or(eq(fileNodes.path, prefix), like(fileNodes.path, `${prefix}/%`)),
        ),
      );
  }
}

/** Soft-delete obsolete `.ui` launchers (todo/notes/profile/pomodoro). */
export async function removeObsoleteUiShortcuts(db: AppDatabase): Promise<void> {
  const now = new Date().toISOString();
  for (const rel of OBSOLETE_UI_PATHS) {
    const path = `${USER_ROOT}/${rel}`;
    await db
      .update(fileNodes)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(fileNodes.path, path), isNull(fileNodes.deletedAt)));
  }
}

/** Ensure virtual FS exists — once per DB handle after warm-up / seed version bump. */
export async function ensureFsSeeded(db: AppDatabase): Promise<void> {
  if (seededDbs.get(db as object) === SEED_VERSION) return;

  if (!(await isFsSeeded(db))) {
    await seedFs(db);
  }
  await seedUiShortcuts(db);
  await removeLegacyCapitalizedDirs(db);
  await removeObsoleteUiShortcuts(db);
  seededDbs.set(db as object, SEED_VERSION);
}
