import type { ChatAttachment, Task } from "@chatgpa/core";
import { IDB_KEYS, idbGet, idbSet } from "./chat-idb.ts";
import {
  deleteSessionOnServer,
  isServerAvailable,
  migrateLocalStoreApi,
  pullThreadsFromServer,
  pushSessionToServer,
  syncPull,
} from "./threads-api.ts";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
  streaming?: boolean;
  toolResults?: Array<{ tool: string; ok: boolean; output?: string; error?: string }>;
  attachments?: ChatAttachment[];
}

export interface NotificationContext {
  todoToday: Task[];
  freeMinutes: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
  notificationContext?: NotificationContext;
}

export interface ChatStore {
  version: 3;
  activeSessionId: string;
  sessions: ChatSession[];
  /** Legacy v2 facts — migrated to server long-term memory on first load. */
  memory?: string[];
  memoryMigrated?: boolean;
}

const STORE_KEY = "chatgpa:v2:store";
const LEGACY_MESSAGES_KEY = "chatgpa:v1:messages";
const LEGACY_MEMORY_KEY = "chatgpa:v1:memory";
const BACKUP_KEY = "chatgpa:v2:store:backup";

export function sessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function titleFromText(text: string, max = 42): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "Nowa rozmowa";
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1).trim()}…`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function migrateLegacy(): ChatStore | null {
  const messages = readJson<StoredMessage[]>(LEGACY_MESSAGES_KEY);
  const memory = readJson<string[]>(LEGACY_MEMORY_KEY);
  if (!messages && !memory) return null;

  const id = sessionId();
  const now = Date.now();
  const session: ChatSession = {
    id,
    title: "Poprzednia rozmowa",
    createdAt: now,
    updatedAt: now,
    messages: Array.isArray(messages) && messages.length > 0 ? messages : [],
  };

  const firstUser = session.messages.find((m) => m.role === "user" && !m.error);
  if (firstUser) session.title = titleFromText(firstUser.content);

  localStorage.removeItem(LEGACY_MESSAGES_KEY);
  localStorage.removeItem(LEGACY_MEMORY_KEY);

  return {
    version: 3,
    activeSessionId: id,
    sessions: [session],
    memory: Array.isArray(memory)
      ? memory.filter((s) => typeof s === "string" && s.trim().length > 0)
      : [],
    memoryMigrated: false,
  };
}

function upgradeV2Store(stored: {
  version?: number;
  activeSessionId: string;
  sessions: ChatSession[];
  memory?: string[];
}): ChatStore {
  return {
    version: 3,
    activeSessionId: stored.activeSessionId,
    sessions: stored.sessions,
    memory: Array.isArray(stored.memory)
      ? stored.memory.filter((s) => typeof s === "string" && s.trim().length > 0)
      : [],
    memoryMigrated: false,
  };
}

export function createSessionFromNotification(
  title: string,
  assistantContent: string,
  context?: NotificationContext,
): ChatSession {
  const now = Date.now();
  return {
    id: sessionId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [{
      id: sessionId(),
      role: "assistant",
      content: assistantContent,
    }],
    notificationContext: context,
  };
}

export function createEmptySession(): ChatSession {
  const now = Date.now();
  return {
    id: sessionId(),
    title: "Nowa rozmowa",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/** Load from localStorage only (sync fallback / migration source). */
function loadStoreFromLocalStorage(): ChatStore {
  const stored = readJson<{
    version?: number;
    activeSessionId: string;
    sessions: ChatSession[];
    memory?: string[];
  }>(STORE_KEY);
  if (stored?.version === 3 && stored.sessions.length > 0) {
    const activeExists = stored.sessions.some((s) => s.id === stored.activeSessionId);
    if (!activeExists) stored.activeSessionId = stored.sessions[0].id;
    return stored as ChatStore;
  }

  if (stored?.version === 2 && stored.sessions.length > 0) {
    const upgraded = upgradeV2Store(stored);
    localStorage.setItem(STORE_KEY, JSON.stringify(upgraded));
    return upgraded;
  }

  const migrated = migrateLegacy();
  if (migrated) {
    localStorage.setItem(STORE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  const session = createEmptySession();
  const fresh: ChatStore = {
    version: 3,
    activeSessionId: session.id,
    sessions: [session],
    memoryMigrated: true,
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
  return fresh;
}

/** Synchronous load — IndexedDB/localStorage; prefer initChatSync() on app start. */
export function loadStore(): ChatStore {
  return loadStoreFromLocalStorage();
}

async function loadStoreFromIdb(): Promise<ChatStore | null> {
  return await idbGet<ChatStore>(IDB_KEYS.store);
}

function mergeSessionMessages(local: ChatSession, remote: ChatSession): ChatSession {
  const byId = new Map<string, StoredMessage>();
  for (const message of local.messages) byId.set(message.id, message);
  for (const message of remote.messages) byId.set(message.id, message);

  const seen = new Set<string>();
  const messages: StoredMessage[] = [];
  for (const message of local.messages) {
    const merged = byId.get(message.id);
    if (merged) {
      messages.push(merged);
      seen.add(message.id);
    }
  }
  for (const message of remote.messages) {
    if (!seen.has(message.id)) {
      messages.push(message);
      seen.add(message.id);
    }
  }

  const newer = remote.updatedAt >= local.updatedAt ? remote : local;
  return {
    ...newer,
    messages,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}

function mergeStores(local: ChatStore, remote: ChatStore): ChatStore {
  const map = new Map<string, ChatSession>();
  for (const session of local.sessions) map.set(session.id, session);
  for (const session of remote.sessions) {
    const existing = map.get(session.id);
    if (!existing) {
      map.set(session.id, session);
    } else {
      map.set(session.id, mergeSessionMessages(existing, session));
    }
  }
  const sessions = [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  const activeExists = sessions.some((s) => s.id === local.activeSessionId);
  const activeSessionId = activeExists
    ? local.activeSessionId
    : remote.activeSessionId && sessions.some((s) => s.id === remote.activeSessionId)
    ? remote.activeSessionId
    : sessions[0]?.id ?? local.activeSessionId;

  return {
    version: 3,
    activeSessionId,
    sessions,
    memory: local.memory,
    memoryMigrated: local.memoryMigrated ?? remote.memoryMigrated,
  };
}

export async function initChatSync(): Promise<ChatStore> {
  const idbStore = await loadStoreFromIdb();
  const localStore = loadStoreFromLocalStorage();
  let store = idbStore ?? localStore;

  if (!idbStore && localStore.sessions.length > 0) {
    await idbSet(IDB_KEYS.store, localStore);
  }

  const serverOk = await isServerAvailable();
  if (!serverOk) {
    await idbSet(IDB_KEYS.store, store);
    return store;
  }

  const serverMigrated = await idbGet<boolean>(IDB_KEYS.serverMigrated);
  const hasLocalData = localStore.sessions.some((s) =>
    s.messages.length > 0 || s.title !== "Nowa rozmowa"
  );

  if (!serverMigrated && hasLocalData) {
    const backup = localStorage.getItem(STORE_KEY);
    if (backup) localStorage.setItem(BACKUP_KEY, backup);

    const migrated = await migrateLocalStoreApi(localStore);
    if (migrated === "ok" || migrated === "conflict") {
      await idbSet(IDB_KEYS.serverMigrated, true);
      if (migrated === "ok") {
        localStorage.removeItem(STORE_KEY);
      } else {
        for (const session of localStore.sessions) {
          await pushSessionToServer(session);
        }
      }
    }
  }

  const cursor = await idbGet<string>(IDB_KEYS.syncCursor);
  const pullResult = await syncPull(cursor);
  if (pullResult) {
    await idbSet(IDB_KEYS.syncCursor, pullResult.cursor);
    if (pullResult.store) {
      store = mergeStores(store, pullResult.store);
    }
  }

  if (!pullResult?.store) {
    const fullPull = await pullThreadsFromServer();
    if (fullPull) store = mergeStores(store, fullPull);
  }

  await idbSet(IDB_KEYS.store, store);
  return store;
}

export async function saveStoreAsync(store: ChatStore): Promise<void> {
  await idbSet(IDB_KEYS.store, store);

  const serverMigrated = await idbGet<boolean>(IDB_KEYS.serverMigrated);
  if (!serverMigrated) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }
}

/** Sync save for backward compatibility during migration window. */
export function saveStore(store: ChatStore) {
  void saveStoreAsync(store);
}

export async function pushChatToServer(store: ChatStore, sessionId?: string): Promise<void> {
  if (!await isServerAvailable()) return;

  const target = sessionId
    ? store.sessions.find((s) => s.id === sessionId)
    : store.sessions.find((s) => s.id === store.activeSessionId);

  if (target) {
    const serverUpdatedAt = await pushSessionToServer(target);
    if (serverUpdatedAt) {
      await idbSet(IDB_KEYS.syncCursor, serverUpdatedAt);
    }
  }
}

export async function deleteChatOnServer(id: string): Promise<void> {
  if (!await isServerAvailable()) return;
  await deleteSessionOnServer(id);
}

export function getActiveSession(store: ChatStore): ChatSession {
  const session = store.sessions.find((s) => s.id === store.activeSessionId);
  return session ?? store.sessions[0];
}

export function markMemoryMigrated(store: ChatStore): ChatStore {
  return { ...store, memory: [], memoryMigrated: true };
}

export function upsertSession(store: ChatStore, session: ChatSession): ChatStore {
  const idx = store.sessions.findIndex((s) => s.id === session.id);
  const sessions = [...store.sessions];
  if (idx === -1) sessions.unshift(session);
  else sessions[idx] = session;
  return { ...store, sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt) };
}

export function getLegacyMemoryFacts(store: ChatStore): string[] {
  if (store.memoryMigrated) return [];
  return store.memory ?? [];
}
