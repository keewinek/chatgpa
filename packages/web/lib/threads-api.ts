import type { ChatAttachment } from "@chatgpa/core";
import type { ChatSession, ChatStore, StoredMessage } from "./chat-storage.ts";

const API = "";

export interface ThreadMessageDto {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
  streaming?: boolean;
  toolResults?: StoredMessage["toolResults"];
  attachments?: ChatAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ThreadDto {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ThreadMessageDto[];
  notificationContext?: ChatSession["notificationContext"];
}

export async function fetchThreads(includeMessages = true): Promise<ThreadDto[]> {
  const qs = includeMessages ? "?include=messages" : "";
  const res = await fetch(`${API}/api/threads${qs}`);
  if (!res.ok) return [];
  const data = await res.json() as { threads?: ThreadDto[] };
  return Array.isArray(data.threads) ? data.threads : [];
}

export async function fetchThreadById(id: string): Promise<ThreadDto | null> {
  const res = await fetch(`${API}/api/threads/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json() as { thread?: ThreadDto };
  return data.thread ?? null;
}

export async function createThreadApi(input: {
  id?: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  notificationContext?: ChatSession["notificationContext"];
}): Promise<ThreadDto | null> {
  const res = await fetch(`${API}/api/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  const data = await res.json() as { thread?: ThreadDto };
  return data.thread ?? null;
}

export async function updateThreadApi(
  id: string,
  patch: {
    title?: string;
    updatedAt?: number;
    notificationContext?: ChatSession["notificationContext"] | null;
  },
): Promise<ThreadDto | null> {
  const res = await fetch(`${API}/api/threads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const data = await res.json() as { thread?: ThreadDto };
  return data.thread ?? null;
}

export async function deleteThreadApi(id: string): Promise<boolean> {
  const res = await fetch(`${API}/api/threads/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return res.ok;
}

export async function createMessageApi(
  threadId: string,
  message: StoredMessage,
  updatedAt?: number,
): Promise<ThreadMessageDto | null> {
  const res = await fetch(`${API}/api/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
      model: message.model,
      provider: message.provider,
      error: message.error,
      streaming: message.streaming,
      toolResults: message.toolResults,
      attachments: message.attachments,
      updatedAt,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { message?: ThreadMessageDto };
  return data.message ?? null;
}

export async function updateMessageApi(
  threadId: string,
  messageId: string,
  patch: Partial<StoredMessage> & { updatedAt?: number },
): Promise<ThreadMessageDto | null> {
  const res = await fetch(
    `${API}/api/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) return null;
  const data = await res.json() as { message?: ThreadMessageDto };
  return data.message ?? null;
}

function threadToSession(thread: ThreadDto): ChatSession {
  const createdAt = new Date(thread.createdAt).getTime();
  const updatedAt = new Date(thread.updatedAt).getTime();
  const messages = (thread.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    model: m.model,
    provider: m.provider,
    error: m.error,
    streaming: m.streaming,
    toolResults: m.toolResults,
    attachments: m.attachments,
  }));
  messages.sort((a, b) => {
    const ma = thread.messages?.find((m) => m.id === a.id);
    const mb = thread.messages?.find((m) => m.id === b.id);
    const ta = ma ? new Date(ma.createdAt).getTime() : 0;
    const tb = mb ? new Date(mb.createdAt).getTime() : 0;
    return ta - tb;
  });
  return {
    id: thread.id,
    title: thread.title,
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    messages,
    notificationContext: thread.notificationContext,
  };
}

export type MigrateLocalResult = "ok" | "conflict" | "fail";

export async function migrateLocalStoreApi(store: ChatStore): Promise<MigrateLocalResult> {
  const res = await fetch(`${API}/api/migrate/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store }),
  });
  if (res.ok) return "ok";
  if (res.status === 409) return "conflict";
  return "fail";
}

export async function pullThreadsFromServer(): Promise<ChatStore | null> {
  const threads = await fetchThreads(true);
  if (!threads.length) return null;

  const sessions: ChatSession[] = threads.map(threadToSession);
  const activeSessionId = sessions[0]?.id ?? "";

  return {
    version: 3,
    activeSessionId,
    sessions,
    memoryMigrated: true,
  };
}

export async function pushSessionToServer(session: ChatSession): Promise<string | null> {
  let threadUpdatedAt: string | null = null;
  const existing = await fetch(`${API}/api/threads/${encodeURIComponent(session.id)}`);
  if (existing.ok) {
    const thread = await updateThreadApi(session.id, {
      title: session.title,
      updatedAt: session.updatedAt,
      notificationContext: session.notificationContext ?? null,
    });
    if (!thread) return null;
    threadUpdatedAt = thread.updatedAt;
  } else {
    const thread = await createThreadApi({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      notificationContext: session.notificationContext,
    });
    if (!thread) return null;
    threadUpdatedAt = thread.updatedAt;
  }

  for (const message of session.messages) {
    const msgRes = await fetch(
      `${API}/api/threads/${encodeURIComponent(session.id)}/messages/${
        encodeURIComponent(message.id)
      }`,
    );
    if (msgRes.ok) {
      const updated = await updateMessageApi(session.id, message.id, message);
      if (!updated) return null;
      if (updated.updatedAt > (threadUpdatedAt ?? "")) threadUpdatedAt = updated.updatedAt;
    } else {
      const created = await createMessageApi(session.id, message);
      if (!created) return null;
      if (created.updatedAt > (threadUpdatedAt ?? "")) threadUpdatedAt = created.updatedAt;
    }
  }

  return threadUpdatedAt;
}

export async function pushStoreToServer(store: ChatStore): Promise<void> {
  for (const session of store.sessions) {
    await pushSessionToServer(session);
  }
}

export async function deleteSessionOnServer(id: string): Promise<void> {
  await deleteThreadApi(id);
}

export async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/health`);
    if (!res.ok) return false;
    const data = await res.json() as { db?: string };
    return data.db === "ok";
  } catch {
    return false;
  }
}

export async function syncPull(cursor?: string | null): Promise<
  {
    cursor: string;
    store: ChatStore | null;
  } | null
> {
  const since = cursor ?? "1970-01-01T00:00:00.000Z";
  const res = await fetch(`${API}/api/sync/pull?since=${encodeURIComponent(since)}`);
  if (!res.ok) return null;

  const data = await res.json() as {
    cursor: string;
    changes: {
      chat_threads?: Array<{
        id: string;
        title?: string;
        updated_at?: string;
        updatedAt?: string;
        metadata?: { notificationContext?: ChatSession["notificationContext"] };
      }>;
      chat_messages?: Array<{
        id: string;
        thread_id?: string;
        threadId?: string;
        role: string;
        content: string;
        model?: string;
        provider?: string;
        created_at?: string;
        createdAt?: string;
        updated_at?: string;
        updatedAt?: string;
        metadata?: {
          error?: boolean;
          streaming?: boolean;
          toolResults?: StoredMessage["toolResults"];
          attachments?: ChatAttachment[];
        };
      }>;
    };
  };

  const threadRows = data.changes.chat_threads ?? [];
  const messageRows = data.changes.chat_messages ?? [];

  if (!threadRows.length && !messageRows.length) {
    return { cursor: data.cursor, store: null };
  }

  const sessionsMap = new Map<string, ChatSession>();
  const messageOrder = new Map<string, Array<{ msg: StoredMessage; ts: number }>>();

  for (const row of threadRows) {
    const updatedAt = row.updatedAt ?? row.updated_at ?? new Date().toISOString();
    sessionsMap.set(row.id, {
      id: row.id,
      title: row.title ?? "Nowa rozmowa",
      createdAt: new Date(updatedAt).getTime(),
      updatedAt: new Date(updatedAt).getTime(),
      messages: [],
      notificationContext: row.metadata?.notificationContext,
    });
  }

  for (const row of messageRows) {
    const threadId = row.threadId ?? row.thread_id ?? "";
    if (!threadId) continue;
    let session = sessionsMap.get(threadId);
    if (!session) {
      const remote = await fetchThreadById(threadId);
      if (remote) {
        session = threadToSession({ ...remote, messages: [] });
        sessionsMap.set(threadId, session);
      } else {
        session = {
          id: threadId,
          title: "Rozmowa",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        };
        sessionsMap.set(threadId, session);
      }
    }
    const createdAt = row.createdAt ?? row.created_at ?? row.updatedAt ?? row.updated_at ??
      new Date().toISOString();
    const updatedAt = row.updatedAt ?? row.updated_at ?? createdAt;
    const ts = new Date(createdAt).getTime();
    const msg: StoredMessage = {
      id: row.id,
      role: row.role as "user" | "assistant",
      content: row.content,
      model: row.model,
      provider: row.provider,
      error: row.metadata?.error,
      streaming: row.metadata?.streaming,
      toolResults: row.metadata?.toolResults,
      attachments: row.metadata?.attachments,
    };
    const bucket = messageOrder.get(threadId) ?? [];
    bucket.push({ msg, ts });
    messageOrder.set(threadId, bucket);
    const updatedTs = new Date(updatedAt).getTime();
    if (updatedTs > session.updatedAt) session.updatedAt = updatedTs;
  }

  for (const [threadId, bucket] of messageOrder) {
    const session = sessionsMap.get(threadId);
    if (!session) continue;
    session.messages = bucket.sort((a, b) => a.ts - b.ts).map((entry) => entry.msg);
  }

  const sessions = [...sessionsMap.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!sessions.length) return { cursor: data.cursor, store: null };

  return {
    cursor: data.cursor,
    store: {
      version: 3,
      activeSessionId: sessions[0].id,
      sessions,
      memoryMigrated: true,
    },
  };
}
