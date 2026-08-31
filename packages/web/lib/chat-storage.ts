import type { ChatAttachment } from "@chatgpa/core";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
  toolResults?: Array<{ tool: string; ok: boolean; output?: string; error?: string }>;
  attachments?: ChatAttachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

export interface ChatStore {
  version: 2;
  activeSessionId: string;
  sessions: ChatSession[];
  memory: string[];
}

const STORE_KEY = "chatgpa:v2:store";
const LEGACY_MESSAGES_KEY = "chatgpa:v1:messages";
const LEGACY_MEMORY_KEY = "chatgpa:v1:memory";

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
    version: 2,
    activeSessionId: id,
    sessions: [session],
    memory: Array.isArray(memory)
      ? memory.filter((s) => typeof s === "string" && s.trim().length > 0)
      : [],
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

export function loadStore(): ChatStore {
  const stored = readJson<ChatStore>(STORE_KEY);
  if (stored?.version === 2 && stored.sessions.length > 0) {
    const activeExists = stored.sessions.some((s) => s.id === stored.activeSessionId);
    if (!activeExists) stored.activeSessionId = stored.sessions[0].id;
    return stored;
  }

  const migrated = migrateLegacy();
  if (migrated) {
    saveStore(migrated);
    return migrated;
  }

  const session = createEmptySession();
  const fresh: ChatStore = {
    version: 2,
    activeSessionId: session.id,
    sessions: [session],
    memory: [],
  };
  saveStore(fresh);
  return fresh;
}

export function saveStore(store: ChatStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function getActiveSession(store: ChatStore): ChatSession {
  const session = store.sessions.find((s) => s.id === store.activeSessionId);
  return session ?? store.sessions[0];
}

export function clearMemory(store: ChatStore): ChatStore {
  return { ...store, memory: [] };
}

export function upsertSession(store: ChatStore, session: ChatSession): ChatStore {
  const idx = store.sessions.findIndex((s) => s.id === session.id);
  const sessions = [...store.sessions];
  if (idx === -1) sessions.unshift(session);
  else sessions[idx] = session;
  return { ...store, sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt) };
}
