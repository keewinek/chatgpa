import { and, eq, isNull } from "drizzle-orm";
import type { ChatAttachment } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import {
  type ChatMessageMetadata,
  chatMessages,
  type ChatThreadMetadata,
  chatThreads,
} from "../db/schema.ts";

export type ThreadMode = "ask" | "plan" | "agent" | "focus";

export interface ThreadMessageDto {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
  streaming?: boolean;
  toolResults?: ChatMessageMetadata["toolResults"];
  attachments?: ChatAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ThreadDto {
  id: string;
  title: string;
  mode?: ThreadMode;
  notificationContext?: ChatThreadMetadata["notificationContext"];
  createdAt: string;
  updatedAt: string;
  messages?: ThreadMessageDto[];
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function isoToMs(iso: string): number {
  const ts = new Date(iso).getTime();
  return Number.isNaN(ts) ? Date.now() : ts;
}

function messageRowToDto(row: typeof chatMessages.$inferSelect): ThreadMessageDto {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role as "user" | "assistant",
    content: row.content,
    model: row.model ?? undefined,
    provider: row.provider ?? undefined,
    error: meta.error ?? undefined,
    streaming: meta.streaming ?? undefined,
    toolResults: meta.toolResults ?? undefined,
    attachments: (meta.attachments as ChatAttachment[] | undefined) ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function threadRowToDto(
  row: typeof chatThreads.$inferSelect,
  messages?: ThreadMessageDto[],
): ThreadDto {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    title: row.title ?? "Nowa rozmowa",
    mode: row.mode ?? undefined,
    notificationContext: meta.notificationContext ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    messages,
  };
}

export function newThreadId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function listThreads(
  db: AppDatabase,
  options: { includeMessages?: boolean } = {},
): Promise<ThreadDto[]> {
  const rows = await db
    .select()
    .from(chatThreads)
    .where(isNull(chatThreads.deletedAt));

  const sorted = rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (!options.includeMessages) {
    return sorted.map((row) => threadRowToDto(row));
  }

  const result: ThreadDto[] = [];
  for (const row of sorted) {
    const messages = await listMessages(db, row.id);
    result.push(threadRowToDto(row, messages));
  }
  return result;
}

export async function getThread(
  db: AppDatabase,
  id: string,
  options: { includeMessages?: boolean } = { includeMessages: true },
): Promise<ThreadDto | null> {
  const rows = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, id), isNull(chatThreads.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const messages = options.includeMessages ? await listMessages(db, id) : undefined;
  return threadRowToDto(row, messages);
}

export interface CreateThreadInput {
  id?: string;
  title?: string;
  mode?: ThreadMode;
  notificationContext?: ChatThreadMetadata["notificationContext"];
  createdAt?: number | string;
  updatedAt?: number | string;
}

export async function createThread(db: AppDatabase, input: CreateThreadInput): Promise<ThreadDto> {
  const now = new Date().toISOString();
  const id = input.id ?? newThreadId();
  const createdAt = typeof input.createdAt === "number"
    ? msToIso(input.createdAt)
    : input.createdAt ?? now;
  const updatedAt = typeof input.updatedAt === "number"
    ? msToIso(input.updatedAt)
    : input.updatedAt ?? createdAt;

  const metadata: ChatThreadMetadata = {};
  if (input.notificationContext) metadata.notificationContext = input.notificationContext;
  if (typeof input.createdAt === "number") metadata.clientCreatedAt = input.createdAt;
  if (typeof input.updatedAt === "number") metadata.clientUpdatedAt = input.updatedAt;

  await db.insert(chatThreads).values({
    id,
    title: input.title?.trim() || "Nowa rozmowa",
    mode: input.mode,
    metadata: Object.keys(metadata).length ? metadata : null,
    createdAt,
    updatedAt,
  });

  return (await getThread(db, id, { includeMessages: false }))!;
}

export interface UpdateThreadInput {
  title?: string;
  mode?: ThreadMode | null;
  notificationContext?: ChatThreadMetadata["notificationContext"] | null;
  updatedAt?: number | string;
}

export async function updateThread(
  db: AppDatabase,
  id: string,
  input: UpdateThreadInput,
): Promise<ThreadDto | null> {
  const existing = await getThread(db, id, { includeMessages: false });
  if (!existing) return null;

  const now = new Date().toISOString();
  const updatedAt = typeof input.updatedAt === "number"
    ? msToIso(input.updatedAt)
    : input.updatedAt ?? now;

  const prevMeta = (await db
    .select({ metadata: chatThreads.metadata })
    .from(chatThreads)
    .where(eq(chatThreads.id, id))
    .limit(1))[0]?.metadata ?? {};

  const metadata: ChatThreadMetadata = { ...prevMeta };
  if (input.notificationContext === null) {
    delete metadata.notificationContext;
  } else if (input.notificationContext) {
    metadata.notificationContext = input.notificationContext;
  }
  if (typeof input.updatedAt === "number") metadata.clientUpdatedAt = input.updatedAt;

  await db
    .update(chatThreads)
    .set({
      title: input.title?.trim() ?? undefined,
      mode: input.mode === null ? null : input.mode ?? undefined,
      metadata: Object.keys(metadata).length ? metadata : null,
      updatedAt,
    })
    .where(eq(chatThreads.id, id));

  return await getThread(db, id, { includeMessages: false });
}

export async function deleteThread(db: AppDatabase, id: string): Promise<ThreadDto | null> {
  const existing = await getThread(db, id, { includeMessages: false });
  if (!existing) return null;

  const now = new Date().toISOString();
  await db
    .update(chatThreads)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(chatThreads.id, id));

  await db
    .update(chatMessages)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(chatMessages.threadId, id));

  return existing;
}

export async function listMessages(db: AppDatabase, threadId: string): Promise<ThreadMessageDto[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.threadId, threadId), isNull(chatMessages.deletedAt)));

  return rows
    .map(messageRowToDto)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getMessage(
  db: AppDatabase,
  threadId: string,
  messageId: string,
): Promise<ThreadMessageDto | null> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.id, messageId),
        eq(chatMessages.threadId, threadId),
        isNull(chatMessages.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? messageRowToDto(rows[0]) : null;
}

export interface CreateMessageInput {
  id?: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
  streaming?: boolean;
  toolResults?: ChatMessageMetadata["toolResults"];
  attachments?: ChatAttachment[];
  createdAt?: number | string;
  updatedAt?: number | string;
}

export async function createMessage(
  db: AppDatabase,
  threadId: string,
  input: CreateMessageInput,
): Promise<ThreadMessageDto | null> {
  const thread = await getThread(db, threadId, { includeMessages: false });
  if (!thread) return null;

  const now = new Date().toISOString();
  const id = input.id ?? newThreadId();
  const createdAt = typeof input.createdAt === "number"
    ? msToIso(input.createdAt)
    : input.createdAt ?? now;
  const updatedAt = typeof input.updatedAt === "number"
    ? msToIso(input.updatedAt)
    : input.updatedAt ?? createdAt;

  const metadata: ChatMessageMetadata = {};
  if (input.error) metadata.error = true;
  if (input.streaming) metadata.streaming = true;
  if (input.toolResults?.length) metadata.toolResults = input.toolResults;
  if (input.attachments?.length) metadata.attachments = input.attachments;

  await db.insert(chatMessages).values({
    id,
    threadId,
    role: input.role,
    content: input.content,
    model: input.model,
    provider: input.provider,
    metadata: Object.keys(metadata).length ? metadata : null,
    createdAt,
    updatedAt,
  });

  const threadUpdatedAt = typeof input.updatedAt === "number"
    ? msToIso(input.updatedAt)
    : updatedAt;
  await db
    .update(chatThreads)
    .set({ updatedAt: threadUpdatedAt })
    .where(eq(chatThreads.id, threadId));

  return (await getMessage(db, threadId, id))!;
}

export interface UpdateMessageInput {
  content?: string;
  model?: string | null;
  provider?: string | null;
  error?: boolean | null;
  streaming?: boolean | null;
  toolResults?: ChatMessageMetadata["toolResults"] | null;
  attachments?: ChatAttachment[] | null;
  updatedAt?: number | string;
}

export async function updateMessage(
  db: AppDatabase,
  threadId: string,
  messageId: string,
  input: UpdateMessageInput,
): Promise<ThreadMessageDto | null> {
  const existing = await getMessage(db, threadId, messageId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updatedAt = typeof input.updatedAt === "number"
    ? msToIso(input.updatedAt)
    : input.updatedAt ?? now;

  const prevMeta = (await db
    .select({ metadata: chatMessages.metadata })
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId))
    .limit(1))[0]?.metadata ?? {};

  const metadata: ChatMessageMetadata = { ...prevMeta };
  if (input.error === null) delete metadata.error;
  else if (input.error !== undefined) metadata.error = input.error;
  if (input.streaming === null) delete metadata.streaming;
  else if (input.streaming !== undefined) metadata.streaming = input.streaming;
  if (input.toolResults === null) delete metadata.toolResults;
  else if (input.toolResults) metadata.toolResults = input.toolResults;
  if (input.attachments === null) delete metadata.attachments;
  else if (input.attachments) metadata.attachments = input.attachments;

  await db
    .update(chatMessages)
    .set({
      content: input.content ?? undefined,
      model: input.model === null ? null : input.model ?? undefined,
      provider: input.provider === null ? null : input.provider ?? undefined,
      metadata: Object.keys(metadata).length ? metadata : null,
      updatedAt,
    })
    .where(eq(chatMessages.id, messageId));

  await db
    .update(chatThreads)
    .set({ updatedAt })
    .where(eq(chatThreads.id, threadId));

  return await getMessage(db, threadId, messageId);
}

export async function deleteMessage(
  db: AppDatabase,
  threadId: string,
  messageId: string,
): Promise<ThreadMessageDto | null> {
  const existing = await getMessage(db, threadId, messageId);
  if (!existing) return null;

  const now = new Date().toISOString();
  await db
    .update(chatMessages)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(chatMessages.id, messageId));

  return existing;
}

/** Convert server thread to client session shape. */
export function threadToClientSession(thread: ThreadDto): {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    model?: string;
    provider?: string;
    error?: boolean;
    streaming?: boolean;
    toolResults?: ChatMessageMetadata["toolResults"];
    attachments?: ChatAttachment[];
  }>;
  notificationContext?: ChatThreadMetadata["notificationContext"];
} {
  const meta = thread.notificationContext;
  return {
    id: thread.id,
    title: thread.title,
    createdAt: isoToMs(thread.createdAt),
    updatedAt: isoToMs(thread.updatedAt),
    messages: (thread.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      provider: m.provider,
      error: m.error,
      streaming: m.streaming,
      toolResults: m.toolResults,
      attachments: m.attachments,
    })),
    notificationContext: meta,
  };
}

export interface MigrateLocalStoreInput {
  activeSessionId: string;
  sessions: Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      model?: string;
      provider?: string;
      error?: boolean;
      streaming?: boolean;
      toolResults?: ChatMessageMetadata["toolResults"];
      attachments?: ChatAttachment[];
    }>;
    notificationContext?: ChatThreadMetadata["notificationContext"];
  }>;
}

export async function migrateLocalStore(
  db: AppDatabase,
  input: MigrateLocalStoreInput,
): Promise<{ threads: number; messages: number }> {
  return await db.transaction(async (tx) => {
    const tdb = tx as unknown as AppDatabase;
    let threadCount = 0;
    let messageCount = 0;

    for (const session of input.sessions) {
      await createThread(tdb, {
        id: session.id,
        title: session.title,
        notificationContext: session.notificationContext,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });
      threadCount++;

      for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i];
        const msgTs = session.createdAt + i * 1000;
        await createMessage(tdb, session.id, {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          model: msg.model,
          provider: msg.provider,
          error: msg.error,
          streaming: msg.streaming,
          toolResults: msg.toolResults,
          attachments: msg.attachments,
          createdAt: msgTs,
          updatedAt: msgTs,
        });
        messageCount++;
      }
    }

    return { threads: threadCount, messages: messageCount };
  });
}

export async function countThreads(db: AppDatabase): Promise<number> {
  const rows = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(isNull(chatThreads.deletedAt));
  return rows.length;
}
