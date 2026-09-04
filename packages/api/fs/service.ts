import { and, eq, isNull, like, not, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import { fileNodes } from "../db/schema.ts";
import { ensureFsSeeded } from "./seed.ts";
import {
  guessMimeType,
  nodeIdForPath,
  resolveVirtualPath,
  toVirtualPath,
  USER_ROOT,
} from "./path.ts";

export type FsEntry = {
  name: string;
  path: string;
  kind: "file" | "directory";
  mimeType?: string | null;
  size?: number;
  updatedAt?: string;
};

export type FsListResult = { path: string; entries: FsEntry[] };
export type FsReadResult = {
  path: string;
  kind: "file";
  content: string;
  mimeType: string | null;
  totalLines: number;
  offset: number;
  limit: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parentPath(internal: string): string | null {
  if (internal === USER_ROOT) return null;
  const idx = internal.lastIndexOf("/");
  return idx === -1 ? null : internal.slice(0, idx);
}

function isUiFile(name: string): boolean {
  return name.toLowerCase().endsWith(".ui");
}

function compareFsEntries(a: FsEntry, b: FsEntry): number {
  const aUi = isUiFile(a.name);
  const bUi = isUiFile(b.name);
  if (aUi !== bUi) return aUi ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
  return a.name.localeCompare(b.name, "pl");
}

async function getNode(db: AppDatabase, internalPath: string) {
  const rows = await db
    .select()
    .from(fileNodes)
    .where(and(eq(fileNodes.path, internalPath), isNull(fileNodes.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/** Includes soft-deleted rows — needed to revive paths under UNIQUE(path). */
async function getNodeAny(db: AppDatabase, internalPath: string) {
  const rows = await db
    .select()
    .from(fileNodes)
    .where(eq(fileNodes.path, internalPath))
    .limit(1);
  return rows[0] ?? null;
}

/** Immediate children only (one path segment under the directory). */
async function listChildren(db: AppDatabase, internalDir: string): Promise<FsEntry[]> {
  const prefix = internalDir === USER_ROOT ? `${USER_ROOT}/` : `${internalDir}/`;
  const rows = await db
    .select()
    .from(fileNodes)
    .where(
      and(
        like(fileNodes.path, `${prefix}%`),
        not(like(fileNodes.path, `${prefix}%/%`)),
        isNull(fileNodes.deletedAt),
        sql`${fileNodes.path} <> ${internalDir}`,
      ),
    );

  const entries: FsEntry[] = rows.map((row) => {
    const name = row.path.slice(prefix.length);
    if (row.kind === "file") {
      return {
        name,
        path: toVirtualPath(row.path),
        kind: "file" as const,
        mimeType: row.mimeType,
        size: row.content?.length ?? 0,
        updatedAt: row.updatedAt,
      };
    }
    return {
      name,
      path: toVirtualPath(row.path),
      kind: "directory" as const,
      updatedAt: row.updatedAt,
    };
  });

  return entries.sort(compareFsEntries);
}

export async function fsList(db: AppDatabase, virtualPath: string): Promise<FsListResult> {
  await ensureFsSeeded(db);
  const resolved = resolveVirtualPath(virtualPath);
  if (!resolved.ok) throw new FsError(resolved.error, 400);

  const node = await getNode(db, resolved.internal);
  if (node && node.kind === "file") {
    throw new FsError("To jest plik, nie katalog", 400);
  }

  const entries = await listChildren(db, resolved.internal);
  return { path: resolved.virtual, entries };
}

export async function fsRead(
  db: AppDatabase,
  virtualPath: string,
  offset = 0,
  limit = 500,
): Promise<FsReadResult> {
  await ensureFsSeeded(db);
  const resolved = resolveVirtualPath(virtualPath);
  if (!resolved.ok) throw new FsError(resolved.error, 400);

  const node = await getNode(db, resolved.internal);
  if (!node) throw new FsError("Plik nie istnieje", 404);
  if (node.kind === "directory") throw new FsError("To jest katalog, nie plik", 400);

  const content = node.content ?? "";
  const lines = content.split("\n");
  const totalLines = lines.length;
  const slice = lines.slice(offset, offset + limit).join("\n");

  return {
    path: resolved.virtual,
    kind: "file",
    content: slice,
    mimeType: node.mimeType ?? guessMimeType(node.path),
    totalLines,
    offset,
    limit,
  };
}

export async function fsWrite(
  db: AppDatabase,
  virtualPath: string,
  content: string,
  createOnly = false,
): Promise<{ path: string; created: boolean }> {
  await ensureFsSeeded(db);
  const resolved = resolveVirtualPath(virtualPath);
  if (!resolved.ok) throw new FsError(resolved.error, 400);

  const existing = await getNode(db, resolved.internal);
  if (existing?.kind === "directory") {
    throw new FsError("Nie można zapisać treści w katalogu", 400);
  }
  if (createOnly && existing) {
    throw new FsError("Plik już istnieje", 409);
  }

  const parent = parentPath(resolved.internal);
  if (parent && parent !== USER_ROOT) {
    const parentNode = await getNode(db, parent);
    if (!parentNode) {
      throw new FsError("Katalog nadrzędny nie istnieje", 404);
    }
  }

  const now = nowIso();
  const name = resolved.internal.split("/").pop() ?? "file";
  const mimeType = guessMimeType(name);

  if (existing) {
    await db
      .update(fileNodes)
      .set({ content, mimeType, updatedAt: now, deletedAt: null })
      .where(eq(fileNodes.id, existing.id));
    await maybeReconcileDomainFiles(db, resolved.virtual);
    return { path: resolved.virtual, created: false };
  }

  // Soft-deleted row still occupies UNIQUE(path) — revive instead of insert.
  const tombstone = await getNodeAny(db, resolved.internal);
  if (tombstone) {
    if (tombstone.kind === "directory") {
      throw new FsError("Ścieżka jest zajęta przez usunięty katalog", 409);
    }
    await db
      .update(fileNodes)
      .set({
        kind: "file",
        content,
        mimeType,
        updatedAt: now,
        deletedAt: null,
      })
      .where(eq(fileNodes.id, tombstone.id));
    await maybeReconcileDomainFiles(db, resolved.virtual);
    return { path: resolved.virtual, created: true };
  }

  await db.insert(fileNodes).values({
    id: nodeIdForPath(resolved.internal),
    path: resolved.internal,
    kind: "file",
    content,
    mimeType,
    createdAt: now,
    updatedAt: now,
  });

  await maybeReconcileDomainFiles(db, resolved.virtual);
  return { path: resolved.virtual, created: true };
}

/** Domain tables mirror virtual files — file wins on Save / fs.write. */
async function maybeReconcileDomainFiles(db: AppDatabase, virtualPath: string): Promise<void> {
  if (virtualPath === "~/memory/long-term.memory") {
    const { importLongTermFromFile } = await import("../memory/service.ts");
    await importLongTermFromFile(db);
    return;
  }
  if (virtualPath === "~/todo/global.todo") {
    const { importTodoFromFile } = await import("../todo/service.ts");
    await importTodoFromFile(db);
  }
}

export async function fsMkdir(db: AppDatabase, virtualPath: string): Promise<{ path: string }> {
  await ensureFsSeeded(db);
  const resolved = resolveVirtualPath(virtualPath);
  if (!resolved.ok) throw new FsError(resolved.error, 400);

  const existing = await getNode(db, resolved.internal);
  if (existing) {
    if (existing.kind === "directory") return { path: resolved.virtual };
    throw new FsError("Ścieżka jest zajęta przez plik", 409);
  }

  const parent = parentPath(resolved.internal);
  if (parent && parent !== USER_ROOT) {
    const parentNode = await getNode(db, parent);
    if (!parentNode) throw new FsError("Katalog nadrzędny nie istnieje", 404);
  }

  const now = nowIso();
  const tombstone = await getNodeAny(db, resolved.internal);
  if (tombstone) {
    if (tombstone.kind === "file") {
      throw new FsError("Ścieżka jest zajęta przez usunięty plik", 409);
    }
    await db
      .update(fileNodes)
      .set({
        kind: "directory",
        content: null,
        mimeType: null,
        updatedAt: now,
        deletedAt: null,
      })
      .where(eq(fileNodes.id, tombstone.id));
    return { path: resolved.virtual };
  }

  await db.insert(fileNodes).values({
    id: nodeIdForPath(resolved.internal),
    path: resolved.internal,
    kind: "directory",
    createdAt: now,
    updatedAt: now,
  });

  return { path: resolved.virtual };
}

export async function fsDelete(db: AppDatabase, virtualPath: string): Promise<{ path: string }> {
  await ensureFsSeeded(db);
  const resolved = resolveVirtualPath(virtualPath);
  if (!resolved.ok) throw new FsError(resolved.error, 400);

  if (resolved.internal === USER_ROOT) {
    throw new FsError("Nie można usunąć katalogu głównego", 400);
  }

  const node = await getNode(db, resolved.internal);
  if (!node) throw new FsError("Ścieżka nie istnieje", 404);

  if (node.kind === "directory") {
    const children = await listChildren(db, resolved.internal);
    if (children.length > 0) {
      throw new FsError("Katalog nie jest pusty", 400);
    }
  }

  const now = nowIso();
  await db
    .update(fileNodes)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(fileNodes.id, node.id));

  return { path: resolved.virtual };
}

export class FsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FsError";
  }
}
