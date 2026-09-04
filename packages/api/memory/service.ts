import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { MemoryEntry, MemoryKind, MemorySource } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { memoryEntries } from "../db/schema.ts";
import { FsError, fsRead, fsWrite } from "../fs/service.ts";

export const DEFAULT_SHORT_TTL_DAYS = 7;
export const LONG_TERM_VIRTUAL_PATH = "~/memory/long-term.memory";

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

function stableContentId(content: string): string {
  let h = 2166136261;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `mem-file-${(h >>> 0).toString(36)}`;
}

/** Parse JSONL (or plain-text lines) from ~/memory/long-term.memory. */
export function parseLongTermFile(content: string): MemoryEntry[] {
  const now = new Date().toISOString();
  const entries: MemoryEntry[] = [];
  const seen = new Set<string>();

  for (const raw of content.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let entry: MemoryEntry | null = null;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed.content === "string" && parsed.content.trim()) {
        const text = parsed.content.trim();
        const id = typeof parsed.id === "string" && parsed.id
          ? parsed.id
          : stableContentId(text);
        entry = {
          id,
          content: text,
          kind: "long",
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : now,
          source: (parsed.source as MemorySource) ?? "user",
          tags: Array.isArray(parsed.tags)
            ? parsed.tags.filter((t): t is string => typeof t === "string")
            : undefined,
          chatId: typeof parsed.chatId === "string" ? parsed.chatId : undefined,
        };
      }
    } catch {
      // plain text line
    }

    if (!entry) {
      entry = {
        id: stableContentId(trimmed),
        content: trimmed,
        kind: "long",
        createdAt: now,
        source: "user",
      };
    }

    if (seen.has(entry.id) || seen.has(entry.content.toLowerCase())) continue;
    seen.add(entry.id);
    seen.add(entry.content.toLowerCase());
    entries.push(entry);
  }

  return entries;
}

export function serializeLongTermFile(entries: MemoryEntry[]): string {
  const longTerm = entries.filter((e) => e.kind === "long");
  if (!longTerm.length) return "";
  return `${longTerm.map((e) => JSON.stringify(e)).join("\n")}\n`;
}

async function readLongTermFileContent(db: AppDatabase): Promise<string> {
  try {
    const file = await fsRead(db, LONG_TERM_VIRTUAL_PATH, 0, 1_000_000);
    return file.content;
  } catch (err) {
    if (err instanceof FsError && err.status === 404) return "";
    throw err;
  }
}

/**
 * File is source of truth for long-term memory.
 * Sync DB rows to match ~/memory/long-term.memory.
 */
export async function importLongTermFromFile(db: AppDatabase): Promise<MemoryEntry[]> {
  const fromFile = parseLongTermFile(await readLongTermFileContent(db));
  const now = new Date().toISOString();

  const dbLong = await db
    .select()
    .from(memoryEntries)
    .where(and(eq(memoryEntries.kind, "long"), isNull(memoryEntries.deletedAt)));

  const fileById = new Map(fromFile.map((e) => [e.id, e]));
  const fileContents = new Set(fromFile.map((e) => e.content.toLowerCase()));

  for (const row of dbLong) {
    const keep = fileById.has(row.id) || fileContents.has(row.content.toLowerCase());
    if (!keep) {
      await db
        .update(memoryEntries)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(memoryEntries.id, row.id));
    }
  }

  const activeAfter = await db
    .select()
    .from(memoryEntries)
    .where(and(eq(memoryEntries.kind, "long"), isNull(memoryEntries.deletedAt)));
  const byId = new Map(activeAfter.map((r) => [r.id, r]));
  const byContent = new Map(
    activeAfter.map((r) => [r.content.toLowerCase(), r]),
  );

  for (const entry of fromFile) {
    const existing = byId.get(entry.id) ?? byContent.get(entry.content.toLowerCase());
    if (existing) {
      if (
        existing.content !== entry.content ||
        existing.source !== entry.source ||
        existing.deletedAt
      ) {
        await db
          .update(memoryEntries)
          .set({
            content: entry.content,
            source: entry.source,
            tags: entry.tags ?? null,
            chatId: entry.chatId ?? null,
            updatedAt: now,
            deletedAt: null,
          })
          .where(eq(memoryEntries.id, existing.id));
      }
      continue;
    }

    await db.insert(memoryEntries).values({
      id: entry.id,
      content: entry.content,
      kind: "long",
      expiresAt: null,
      source: entry.source,
      tags: entry.tags ?? null,
      chatId: entry.chatId ?? null,
      createdAt: entry.createdAt,
      updatedAt: now,
    });
  }

  return fromFile;
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

const memoryCleanupDone = new WeakMap<object, true>();

export async function listMemory(
  db: AppDatabase,
  options: { kind?: MemoryKind; includeExpired?: boolean } = {},
): Promise<MemoryEntry[]> {
  if (!options.includeExpired && !memoryCleanupDone.has(db as object)) {
    await cleanupExpiredShort(db);
    memoryCleanupDone.set(db as object, true);
  }

  // Long-term: file wins — pull edits from ~/memory/long-term.memory into DB.
  if (options.kind !== "short") {
    await importLongTermFromFile(db);
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

/** Write long-term DB rows out to the file (after API mutations). */
export async function syncLongTermFile(db: AppDatabase): Promise<void> {
  const rows = await db
    .select()
    .from(memoryEntries)
    .where(and(eq(memoryEntries.kind, "long"), isNull(memoryEntries.deletedAt)));
  const longTerm = rows.map(rowToEntry).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await fsWrite(db, LONG_TERM_VIRTUAL_PATH, serializeLongTermFile(longTerm));
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
