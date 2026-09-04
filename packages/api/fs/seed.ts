import { eq } from "drizzle-orm";
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

/** `.ui` launchers colocated with their data folders. */
export const SEED_UI_SHORTCUTS = [
  { dir: "calendar", file: "calendar.ui", view: "calendar", title: "Kalendarz" },
  { dir: "school", file: "timetable.ui", view: "timetable", title: "Plan lekcji" },
  { dir: "todo", file: "todo.ui", view: "todo", title: "TODO" },
  { dir: "notes", file: "notes.ui", view: "notes", title: "Notatki" },
  { dir: "profile", file: "profile.ui", view: "profile", title: "Profil czasu" },
  { dir: "pomodoro", file: "pomodoro.ui", view: "pomodoro", title: "Pomodoro" },
] as const;

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

/** Idempotent — safe on every request so existing DBs get new shortcuts. */
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
}

/** Ensure virtual FS exists — idempotent, safe on every request. */
export async function ensureFsSeeded(db: AppDatabase): Promise<void> {
  if (!(await isFsSeeded(db))) {
    await seedFs(db);
  }
  await seedUiShortcuts(db);
}
