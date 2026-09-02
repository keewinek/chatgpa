import type { AppDatabase } from "../db/client.ts";
import { fsDelete, type FsEntry, fsList, fsMkdir, fsRead, fsWrite } from "../fs/service.ts";
import { resolveVirtualPath } from "../fs/path.ts";

export const NOTES_VIRTUAL_ROOT = "~/notes";

export type NotesListResult = { path: string; entries: FsEntry[] };
export type NotesReadResult = Awaited<ReturnType<typeof fsRead>>;

/** Resolve a note path relative to ~/notes (or accept full ~/notes/... paths). */
export function resolveNotesPath(input?: string): ReturnType<typeof resolveVirtualPath> {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) return resolveVirtualPath(NOTES_VIRTUAL_ROOT);

  if (trimmed === "~/notes" || trimmed === "/home/notes") {
    return resolveVirtualPath(NOTES_VIRTUAL_ROOT);
  }
  if (trimmed.startsWith("~/notes/") || trimmed.startsWith("/home/notes/")) {
    return resolveVirtualPath(trimmed);
  }
  if (trimmed.startsWith("notes/")) {
    return resolveVirtualPath(`~/${trimmed}`);
  }

  return resolveVirtualPath(`~/notes/${trimmed.replace(/^\//, "")}`);
}

function ensureNotesPath(resolved: ReturnType<typeof resolveVirtualPath>) {
  if (!resolved.ok) return resolved;
  if (
    resolved.virtual !== NOTES_VIRTUAL_ROOT &&
    !resolved.virtual.startsWith(`${NOTES_VIRTUAL_ROOT}/`)
  ) {
    return { ok: false as const, error: "Ścieżka musi być w ~/notes/" };
  }
  return resolved;
}

function ensureMarkdownPath(virtualPath: string): string {
  if (virtualPath.endsWith(".md")) return virtualPath;
  return `${virtualPath}.md`;
}

export async function notesList(
  db: AppDatabase,
  relativePath?: string,
): Promise<NotesListResult> {
  const resolved = ensureNotesPath(resolveNotesPath(relativePath));
  if (!resolved.ok) throw new NotesError(resolved.error, 400);
  return await fsList(db, resolved.virtual);
}

function resolveNoteFilePath(relativePath: string) {
  const resolved = ensureNotesPath(resolveNotesPath(relativePath));
  if (!resolved.ok) return resolved;

  const withExt = ensureMarkdownPath(resolved.virtual);
  if (withExt === resolved.virtual) return resolved;

  const again = resolveVirtualPath(withExt);
  if (!again.ok) return again;
  return ensureNotesPath(again);
}

export async function notesRead(
  db: AppDatabase,
  relativePath: string,
  offset = 0,
  limit = 5000,
): Promise<NotesReadResult> {
  const resolved = resolveNoteFilePath(relativePath);
  if (!resolved.ok) throw new NotesError(resolved.error, 400);
  return await fsRead(db, resolved.virtual, offset, limit);
}

export async function notesWrite(
  db: AppDatabase,
  relativePath: string,
  content: string,
  createOnly = false,
): Promise<{ path: string; created: boolean }> {
  const resolved = resolveNoteFilePath(relativePath);
  if (!resolved.ok) throw new NotesError(resolved.error, 400);

  await ensureParentDirs(db, resolved.virtual);
  return await fsWrite(db, resolved.virtual, content, createOnly);
}

export async function notesAppend(
  db: AppDatabase,
  relativePath: string,
  content: string,
): Promise<{ path: string }> {
  const resolved = resolveNoteFilePath(relativePath);
  if (!resolved.ok) throw new NotesError(resolved.error, 400);

  await ensureParentDirs(db, resolved.virtual);

  let existing = "";
  try {
    const file = await fsRead(db, resolved.virtual, 0, 1_000_000);
    existing = file.content;
  } catch {
    // new file
  }

  const separator = existing.length && !existing.endsWith("\n") ? "\n" : "";
  await fsWrite(db, resolved.virtual, `${existing}${separator}${content}`);
  return { path: resolved.virtual };
}

export async function notesMkdir(
  db: AppDatabase,
  relativePath: string,
): Promise<{ path: string }> {
  const resolved = ensureNotesPath(resolveNotesPath(relativePath));
  if (!resolved.ok) throw new NotesError(resolved.error, 400);
  return await fsMkdir(db, resolved.virtual);
}

export async function notesDelete(
  db: AppDatabase,
  relativePath: string,
): Promise<{ path: string }> {
  const resolved = resolveNoteFilePath(relativePath);
  if (!resolved.ok) throw new NotesError(resolved.error, 400);
  return await fsDelete(db, resolved.virtual);
}

export class NotesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NotesError";
  }
}

async function ensureParentDirs(db: AppDatabase, virtualPath: string): Promise<void> {
  const resolved = resolveVirtualPath(virtualPath);
  if (!resolved.ok) throw new NotesError(resolved.error, 400);

  const relative = resolved.virtual === "~" ? "" : resolved.virtual.slice(2);
  const parts = relative.split("/").filter(Boolean);
  parts.pop();

  let path = "~";
  for (const part of parts) {
    path = path === "~" ? `~/${part}` : `${path}/${part}`;
    try {
      await fsMkdir(db, path);
    } catch {
      // directory may already exist
    }
  }
}
