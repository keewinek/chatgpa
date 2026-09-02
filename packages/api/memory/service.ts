import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { MemoryEntry, MemoryKind, MemorySource } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { memoryEntries } from "../db/schema.ts";
import { fsWrite } from "../fs/service.ts";
import { USER_ROOT } from "../fs/path.ts";

export const DEFAULT_SHORT_TTL_DAYS = 7;
export const LONG_TERM_VIRTUAL_PATH = "~/memory/long-term.memory";
const _LONG_TERM_INTERNAL_PATH = `${USER_ROOT}/memory/long-term.memory`;

export function newMemoryId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rowToEntry(row: typeof memoryEntries.$inferSelect): MemoryEntry {
  return {
    id: row.id,
    content: row.content,
    kind: row.kind as MemoryKind,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt ?? undefined,
    source: row.source as MemorySource,
    tags: row.tags ?? undefined,
    chatId: row.chatId ?? undefined,
  };
}

function isExpired(entry: MemoryEntry, now = new Date()): boolean {
  if (entry.kind !== "short" || !entry.expiresAt) return false;
  return new Date(entry.expiresAt) <= now;
}

function addDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function cleanupExpiredShort(db: AppDatabase): Promise<number> {
  const now = new Date().toISOString();
  const rows = await db
    .select({ id: memoryEntries.id })
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.kind, "short"),
        isNull(memoryEntries.deletedAt),
        or(
          lte(memoryEntries.expiresAt, now),
        ),
      ),
    );

  if (!rows.length) return 0;

  for (const row of rows) {
    await db
      .update(memoryEntries)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(memoryEntries.id, row.id));
  }
  return rows.length;
}

export async function listMemory(
  db: AppDatabase,
  options: { kind?: MemoryKind; includeExpired?: boolean } = {},
): Promise<MemoryEntry[]> {
  if (!options.includeExpired) {
    await cleanupExpiredShort(db);
  }

  const rows = await db
    .select()
    .from(memoryEntries)
    .where(isNull(memoryEntries.deletedAt));

  let entries = rows.map(rowToEntry);
  if (options.kind) entries = entries.filter((e) => e.kind === options.kind);
  if (!options.includeExpired) entries = entries.filter((e) => !isExpired(e));

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function rememberMemory(
  db: AppDatabase,
  options: {
    content: string;
    kind?: MemoryKind;
    expiresInDays?: number;
    source?: MemorySource;
    tags?: string[];
    chatId?: string;
  },
): Promise<MemoryEntry> {
  const content = options.content.trim();
  if (!content) throw new Error("Treść pamięci nie może być pusta");

  const kind = options.kind ?? "long";
  const existing = await listMemory(db, { kind });
  const duplicate = existing.find((e) => e.content.toLowerCase() === content.toLowerCase());
  if (duplicate) return duplicate;

  const now = new Date().toISOString();
  const entry: MemoryEntry = {
    id: newMemoryId(),
    content,
    kind,
    createdAt: now,
    source: options.source ?? "ai",
    tags: options.tags,
    chatId: options.chatId,
  };

  if (kind === "short") {
    const days = options.expiresInDays ?? DEFAULT_SHORT_TTL_DAYS;
    entry.expiresAt = addDays(days);
  }

  await db.insert(memoryEntries).values({
    id: entry.id,
    content: entry.content,
    kind: entry.kind,
    expiresAt: entry.expiresAt ?? null,
    source: entry.source,
    tags: entry.tags ?? null,
    chatId: entry.chatId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  if (kind === "long") await syncLongTermFile(db);
  return entry;
}

export async function forgetMemory(
  db: AppDatabase,
  options: { id?: string; content?: string },
): Promise<MemoryEntry | null> {
  const entries = await listMemory(db, { includeExpired: true });
  let target: MemoryEntry | undefined;

  if (options.id) {
    target = entries.find((e) => e.id === options.id);
  } else if (options.content) {
    const needle = options.content.trim().toLowerCase();
    target = entries.find((e) => e.content.toLowerCase() === needle);
  }

  if (!target) return null;

  const now = new Date().toISOString();
  await db
    .update(memoryEntries)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(memoryEntries.id, target.id));

  if (target.kind === "long") await syncLongTermFile(db);
  return target;
}

export async function clearMemory(
  db: AppDatabase,
  kind: MemoryKind | "all",
): Promise<number> {
  const entries = await listMemory(db, { includeExpired: kind === "all" });
  const toClear = kind === "all" ? entries : entries.filter((e) => e.kind === kind);
  if (!toClear.length) return 0;

  const now = new Date().toISOString();
  for (const entry of toClear) {
    await db
      .update(memoryEntries)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(memoryEntries.id, entry.id));
  }

  if (kind === "long" || kind === "all") await syncLongTermFile(db);
  return toClear.length;
}

export async function migrateLegacyStrings(
  db: AppDatabase,
  strings: string[],
): Promise<number> {
  let count = 0;
  for (const text of strings) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const existing = await listMemory(db, { kind: "long" });
    if (existing.some((e) => e.content.toLowerCase() === trimmed.toLowerCase())) continue;
    await rememberMemory(db, { content: trimmed, kind: "long", source: "system" });
    count++;
  }
  return count;
}

export async function syncLongTermFile(db: AppDatabase): Promise<void> {
  const longTerm = await listMemory(db, { kind: "long" });
  const lines = longTerm.map((e) => JSON.stringify(e)).join("\n");
  const content = lines ? `${lines}\n` : "";
  await fsWrite(db, LONG_TERM_VIRTUAL_PATH, content);
}

/** In-memory store for offline / tests when DB is unavailable. */
export class MemoryStore {
  entries: MemoryEntry[];
  private dirty = false;

  constructor(entries: MemoryEntry[] = []) {
    this.entries = [...entries];
  }

  static fromLegacyStrings(strings: string[]): MemoryStore {
    const now = new Date().toISOString();
    const entries = strings
      .map((s) => s.trim())
      .filter(Boolean)
      .map((content) => ({
        id: newMemoryId(),
        content,
        kind: "long" as const,
        createdAt: now,
        source: "system" as const,
      }));
    return new MemoryStore(entries);
  }

  isDirty(): boolean {
    return this.dirty;
  }

  markClean(): void {
    this.dirty = false;
  }

  private active(): MemoryEntry[] {
    const now = new Date();
    return this.entries.filter((e) => !isExpired(e, now));
  }

  list(options: { kind?: MemoryKind; includeExpired?: boolean } = {}): MemoryEntry[] {
    let items = options.includeExpired ? [...this.entries] : this.active();
    if (options.kind) items = items.filter((e) => e.kind === options.kind);
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  remember(options: {
    content: string;
    kind?: MemoryKind;
    expiresInDays?: number;
    source?: MemorySource;
    tags?: string[];
    chatId?: string;
  }): MemoryEntry {
    const content = options.content.trim();
    const kind = options.kind ?? "long";
    const duplicate = this.active().find(
      (e) => e.kind === kind && e.content.toLowerCase() === content.toLowerCase(),
    );
    if (duplicate) return duplicate;

    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: newMemoryId(),
      content,
      kind,
      createdAt: now,
      source: options.source ?? "ai",
      tags: options.tags,
      chatId: options.chatId,
    };
    if (kind === "short") {
      entry.expiresAt = addDays(options.expiresInDays ?? DEFAULT_SHORT_TTL_DAYS);
    }
    this.entries.push(entry);
    this.dirty = true;
    return entry;
  }

  forget(options: { id?: string; content?: string }): MemoryEntry | null {
    let idx = -1;
    if (options.id) idx = this.entries.findIndex((e) => e.id === options.id);
    else if (options.content) {
      const needle = options.content.trim().toLowerCase();
      idx = this.entries.findIndex((e) => e.content.toLowerCase() === needle);
    }
    if (idx === -1) return null;
    const [removed] = this.entries.splice(idx, 1);
    this.dirty = true;
    return removed;
  }

  clear(kind: MemoryKind | "all"): number {
    const before = this.entries.length;
    if (kind === "all") this.entries = [];
    else this.entries = this.entries.filter((e) => e.kind !== kind);
    const removed = before - this.entries.length;
    if (removed > 0) this.dirty = true;
    return removed;
  }

  async loadFromDb(db: AppDatabase): Promise<void> {
    this.entries = await listMemory(db);
    this.dirty = false;
  }

  async saveToDb(db: AppDatabase): Promise<void> {
    if (!this.dirty) return;
    const dbEntries = await listMemory(db, { includeExpired: true });
    const dbIds = new Set(dbEntries.map((e) => e.id));
    const storeIds = new Set(this.entries.map((e) => e.id));

    for (const entry of dbEntries) {
      if (!storeIds.has(entry.id)) {
        await forgetMemory(db, { id: entry.id });
      }
    }

    for (const entry of this.entries) {
      if (!dbIds.has(entry.id)) {
        await db.insert(memoryEntries).values({
          id: entry.id,
          content: entry.content,
          kind: entry.kind,
          expiresAt: entry.expiresAt ?? null,
          source: entry.source,
          tags: entry.tags ?? null,
          chatId: entry.chatId ?? null,
          createdAt: entry.createdAt,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await syncLongTermFile(db);
    this.dirty = false;
  }
}
