export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
  toolResults?: Array<{ tool: string; ok: boolean; output?: string; error?: string }>;
}

const MESSAGES_KEY = "chatgpa:v1:messages";
const MEMORY_KEY = "chatgpa:v1:memory";

export const WELCOME_MESSAGE: StoredMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Cześć — tu ChatGPA. Pomogę Ci ogarniać szkołę: plan nauki, wyjaśnienia, quizy i pamięć o Twoich celach. " +
    "Mogę zapamiętać fakty (np. „jestem w 3A”) i używać narzędzi. Odpowiadam w Markdown.",
  provider: "system",
  model: "welcome",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadMessages(): StoredMessage[] {
  const stored = readJson<StoredMessage[]>(MESSAGES_KEY, []);
  if (!Array.isArray(stored) || stored.length === 0) return [WELCOME_MESSAGE];
  return stored;
}

export function saveMessages(messages: StoredMessage[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

export function loadMemory(): string[] {
  const stored = readJson<string[]>(MEMORY_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter((s) => typeof s === "string" && s.trim().length > 0);
}

export function saveMemory(memory: string[]) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
}

export function clearChatStorage() {
  localStorage.removeItem(MESSAGES_KEY);
  localStorage.removeItem(MEMORY_KEY);
}
