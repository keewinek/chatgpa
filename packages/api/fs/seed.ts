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
  "school/librus",
] as const;

export async function isFsSeeded(db: AppDatabase): Promise<boolean> {
  const rows = await db
    .select({ id: fileNodes.id })
    .from(fileNodes)
    .where(eq(fileNodes.path, `${USER_ROOT}/memory`))
    .limit(1);
  return rows.length > 0;
}

export async function seedFs(db: AppDatabase): Promise<void> {
  const now = new Date().toISOString();

  for (const rel of SEED_DIRECTORIES) {
    const path = `${USER_ROOT}/${rel}`;
    await db
      .insert(fileNodes)
      .values({
        id: nodeIdForPath(path),
        path,
        kind: "directory",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }
}

/** Ensure virtual FS exists — idempotent, safe on every request. */
export async function ensureFsSeeded(db: AppDatabase): Promise<void> {
  if (await isFsSeeded(db)) return;
  await seedFs(db);
}
