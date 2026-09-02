import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "../db/client.ts";
import {
  chatMessages,
  chatThreads,
  fileNodes,
  memoryEntries,
  profile,
  tasks,
} from "../db/schema.ts";
import type { SyncChange, SyncEntity, SyncPullResponse, SyncPushResult } from "./types.ts";
import { SYNC_ENTITIES } from "./types.ts";

const ENTITY_TABLES = {
  profile,
  chat_threads: chatThreads,
  chat_messages: chatMessages,
  memory_entries: memoryEntries,
  tasks,
  file_nodes: fileNodes,
} as const;

function parseSince(since?: string | null): Date {
  if (!since) return new Date(0);
  const parsed = new Date(since);
  if (Number.isNaN(parsed.getTime())) return new Date(0);
  return parsed;
}

function rowToRecord(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

function latestCursor(rows: Record<string, unknown>[][]): string {
  let max = 0;
  for (const group of rows) {
    for (const row of group) {
      const updatedAt = row.updatedAt ?? row.updated_at;
      if (typeof updatedAt === "string") {
        const ts = new Date(updatedAt).getTime();
        if (ts > max) max = ts;
      }
    }
  }
  return new Date(max || Date.now()).toISOString();
}

export async function pullChanges(
  db: AppDatabase,
  since?: string | null,
): Promise<SyncPullResponse> {
  const sinceIso = parseSince(since).toISOString();
  const changes = {} as SyncPullResponse["changes"];

  for (const entity of SYNC_ENTITIES) {
    const table = ENTITY_TABLES[entity];
    const rows = await db
      .select()
      .from(table)
      .where(gt(table.updatedAt, sinceIso));
    changes[entity] = rows.map((row) => rowToRecord(row as Record<string, unknown>));
  }

  return { cursor: latestCursor(SYNC_ENTITIES.map((entity) => changes[entity])), changes };
}

const FIELD_ALIASES: Record<string, string> = {
  display_name: "displayName",
  class_name: "className",
  target_overall_average: "targetOverallAverage",
  daily_study_minutes: "dailyStudyMinutes",
  quiet_hours: "quietHours",
  weak_subjects: "weakSubjects",
  thread_id: "threadId",
  expires_at: "expiresAt",
  chat_id: "chatId",
  subject_id: "subjectId",
  due_date: "dueDate",
  roi_score: "roiScore",
  estimated_minutes: "estimatedMinutes",
  mime_type: "mimeType",
  created_at: "createdAt",
  updated_at: "updatedAt",
  deleted_at: "deletedAt",
};

function toCamelKey(key: string): string {
  return FIELD_ALIASES[key] ?? key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toRowValues(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[toCamelKey(key)] = value;
  }
  return out;
}

async function getExistingUpdatedAt(
  db: AppDatabase,
  entity: SyncEntity,
  id: string,
): Promise<string | null> {
  const table = ENTITY_TABLES[entity];
  const rows = await db.select({ updatedAt: table.updatedAt }).from(table).where(eq(table.id, id))
    .limit(1);
  return rows[0]?.updatedAt ?? null;
}

export async function pushChanges(
  db: AppDatabase,
  changes: SyncChange[],
): Promise<SyncPushResult> {
  let applied = 0;
  let skipped = 0;
  const errors: SyncPushResult["errors"] = [];

  for (let index = 0; index < changes.length; index++) {
    const change = changes[index];
    const table = ENTITY_TABLES[change.entity];

    try {
      if (change.op === "delete") {
        const id = change.id ?? (change.data?.id as string | undefined);
        if (!id) {
          errors.push({ index, message: "Delete requires id" });
          continue;
        }
        const now = new Date().toISOString();
        await db
          .update(table)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(eq(table.id, id), isNull(table.deletedAt)));
        applied++;
        continue;
      }

      if (!change.data || typeof change.data.id !== "string") {
        errors.push({ index, message: "Upsert requires data.id" });
        continue;
      }

      const id = change.data.id;
      const row = toRowValues(change.data);
      const incomingUpdatedAt = (change.updatedAt ?? row.updatedAt) as string | undefined;
      const existingUpdatedAt = await getExistingUpdatedAt(db, change.entity, id);

      if (existingUpdatedAt && incomingUpdatedAt) {
        if (new Date(incomingUpdatedAt) <= new Date(existingUpdatedAt)) {
          skipped++;
          continue;
        }
      }

      const now = new Date().toISOString();
      row.updatedAt = incomingUpdatedAt ?? now;
      if (!row.createdAt) row.createdAt = now;

      const { id: _id, createdAt, ...updateFields } = row;

      await db
        .insert(table)
        .values(row as never)
        .onConflictDoUpdate({
          target: table.id,
          set: {
            ...updateFields,
            updatedAt: sql`excluded.updated_at`,
          } as never,
        });

      applied++;
    } catch (err) {
      errors.push({
        index,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { applied, skipped, errors };
}

export function isSyncEntity(value: string): value is SyncEntity {
  return (SYNC_ENTITIES as string[]).includes(value);
}
