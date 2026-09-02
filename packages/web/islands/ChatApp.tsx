import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { MemoryEntry } from "@chatgpa/core";
import ChatBubble from "./ChatBubble.tsx";
import ChatComposer from "./ChatComposer.tsx";
import ChatEmpty from "./ChatEmpty.tsx";
import ChatSidebar from "./ChatSidebar.tsx";
import TimetablePanel from "./TimetablePanel.tsx";
import FilesPanel from "./FilesPanel.tsx";
import TodoPanel from "./TodoPanel.tsx";
import {
  type ChatSession,
  type ChatStore,
  createEmptySession,
  getActiveSession,
  getLegacyMemoryFacts,
  loadStore,
  markMemoryMigrated,
  saveStore,
  sessionId,
  type StoredMessage,
  titleFromText,
  upsertSession,
} from "../lib/chat-storage.ts";
import {
  type ChatStreamEvent,
  fetchModels,
  type PendingFile,
  pendingFrom,
  releasePending,
  streamChat,
  uploadFile,
} from "../lib/chat-api.ts";
import {
  clearShortMemory,
  fetchMemory,
  migrateLegacyMemory,
} from "../lib/memory-api.ts";
import { loadGroupPrefs } from "../lib/timetable-storage.ts";
import type { ChatAttachment } from "@chatgpa/core";

function msgId() {
  return sessionId();
}

function updateStore(store: ChatStore, session: ChatSession): ChatStore {
  const next = upsertSession(store, session);
  saveStore(next);
  return next;
}

function memorySummary(entries: MemoryEntry[]): string {
  if (!entries.length) return "";
  const short = entries.filter((e) => e.kind === "short").length;
  const long = entries.filter((e) => e.kind === "long").length;
  const parts: string[] = [];
  if (long) parts.push(`${long} długich`);
  if (short) parts.push(`${short} krótkich`);
  return ` · ${parts.join(", ")}`;
}

export default function ChatApp() {
  const store = useSignal<ChatStore>(loadStore());
  const memoryEntries = useSignal<MemoryEntry[]>([]);
  const input = useSignal("");
  const loading = useSignal(false);
  const status = useSignal("Łączenie…");
  const sidebarOpen = useSignal(false);
  const view = useSignal<"chat" | "timetable" | "files" | "todo">("chat");
  const pending = useSignal<PendingFile[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const session = () => getActiveSession(store.value);
  const messages = session().messages;

  async function refreshMemory() {
    const legacy = getLegacyMemoryFacts(store.value);
    if (legacy.length) {
      memoryEntries.value = await migrateLegacyMemory(legacy);
      const next = markMemoryMigrated(store.value);
      setStore(next);
      saveStore(next);
      return;
    }
    memoryEntries.value = await fetchMemory();
  }

  useEffect(() => {
    void refreshMemory();
    fetchModels()
      .then(({ models }) => {
        const ready = models.filter((m) => m.configured);
        const mem = memorySummary(memoryEntries.value);
        status.value = ready.length
          ? `Online · ${ready.length} modele AI${mem}`
          : "Brak kluczy AI — ustaw GEMINI_API_KEY w Deno Deploy.";
      })
      .catch(() => {
        status.value = "Offline — uruchom `deno task dev` lokalnie.";
      });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        newChat();
      }
      if (e.key === "Escape" && sidebarOpen.value) sidebarOpen.value = false;
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading.value]);

  function setStore(next: ChatStore) {
    store.value = next;
  }

  function switchSession(id: string) {
    if (loading.value || id === store.value.activeSessionId) return;
    setStore({ ...store.value, activeSessionId: id });
    saveStore(store.value);
    input.value = "";
    sidebarOpen.value = false;
  }

  function newChat() {
    if (loading.value) return;
    const s = createEmptySession();
    setStore({ ...store.value, activeSessionId: s.id, sessions: [s, ...store.value.sessions] });
    saveStore(store.value);
    input.value = "";
    sidebarOpen.value = false;
  }

  function deleteChat(id: string) {
    if (loading.value) return;
    const rest = store.value.sessions.filter((s) => s.id !== id);
    if (!rest.length) {
      const s = createEmptySession();
      setStore({ ...store.value, activeSessionId: s.id, sessions: [s] });
    } else {
      const activeId = store.value.activeSessionId === id
        ? rest[0].id
        : store.value.activeSessionId;
      setStore({ ...store.value, sessions: rest, activeSessionId: activeId });
    }
    saveStore(store.value);
    input.value = "";
    sidebarOpen.value = false;
  }

  async function handleClearShortMemory() {
    if (loading.value) return;
    memoryEntries.value = await clearShortMemory();
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input.value).trim();
    if ((!text && !pending.value.length) || loading.value) return;

    if (text === "/todo" || text.startsWith("/todo ")) {
      view.value = "todo";
      input.value = "";
      sidebarOpen.value = false;
      return;
    }

    let attachments: ChatAttachment[] = [];
    if (pending.value.length) {
      try {
        attachments = await Promise.all(pending.value.map((p) => uploadFile(p.file)));
      } catch (err) {
        status.value = err instanceof Error ? err.message : String(err);
        return;
      }
      pending.value.forEach(releasePending);
      pending.value = [];
    }

    const current = { ...session() };
    current.messages = [
      ...current.messages,
      {
        id: msgId(),
        role: "user",
        content: text || "Przesłane pliki.",
        attachments: attachments.length ? attachments : undefined,
      },
    ];
    current.updatedAt = Date.now();
    if (current.title === "Nowa rozmowa" && text) current.title = titleFromText(text);
    setStore(updateStore(store.value, current));
    if (!overrideText) input.value = "";
    loading.value = true;

    const legacyFacts = getLegacyMemoryFacts(store.value);
    await completeChat(current.messages.filter((m) => !m.error), legacyFacts);
    loading.value = false;
  }

  function patchMessage(id: string, patch: Partial<StoredMessage>) {
    const s = session();
    const messages = s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setStore(updateStore(store.value, { ...s, messages, updatedAt: Date.now() }));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function completeChat(history: StoredMessage[], legacyFacts: string[]) {
    const assistantId = msgId();
    const s = session();
    setStore(updateStore(store.value, {
      ...s,
      messages: [...s.messages, {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      }],
      updatedAt: Date.now(),
    }));

    await streamChat(history, legacyFacts, loadGroupPrefs(), (event: ChatStreamEvent) => {
      if (event.type === "delta") {
        const current = getActiveSession(store.value).messages.find((m) => m.id === assistantId);
        patchMessage(assistantId, { content: (current?.content ?? "") + event.text });
        return;
      }
      if (event.type === "replace") {
        patchMessage(assistantId, { content: event.text });
        return;
      }
      if (event.type === "tool") {
        patchMessage(assistantId, { toolResults: event.results });
        return;
      }
      if (event.type === "error") {
        const detail = (event.attempts as Array<{ model?: string; error?: string }>)?.map((a) =>
          `${a.model ?? "?"}${a.error ? ` (${a.error})` : ""}`
        ).join(" → ");
        const s = session();
        const messages = s.messages.map((m) =>
          m.id === assistantId
            ? {
              ...m,
              content: `${event.error}${detail ? `\n\nPróby: ${detail}` : ""}`,
              error: true,
              streaming: false,
            }
            : m
        );
        setStore(updateStore(store.value, { ...s, messages, updatedAt: Date.now() }));
        memoryEntries.value = event.memory;
        return;
      }
      if (event.type === "done") {
        const s = session();
        const messages = s.messages.map((m) =>
          m.id === assistantId
            ? {
              ...m,
              content: event.content,
              model: event.model,
              provider: event.provider,
              toolResults: event.toolResults,
              attachments: event.attachments,
              streaming: false,
            }
            : m
        );
        setStore(updateStore(store.value, { ...s, messages, updatedAt: Date.now() }));
        memoryEntries.value = event.memory;
        status.value = `Online · odpowiedź: ${event.model}${memorySummary(event.memory)}`;
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  async function retryLast() {
    if (loading.value) return;
    const s = session();
    const msgs = [...s.messages];
    if (!msgs.length || !msgs[msgs.length - 1].error) return;
    msgs.pop();
    const updated = { ...s, messages: msgs, updatedAt: Date.now() };
    setStore(updateStore(store.value, updated));
    loading.value = true;
    await completeChat(msgs.filter((m) => !m.error), getLegacyMemoryFacts(store.value));
    loading.value = false;
  }

  return (
    <div class="chat-app">
      <ChatSidebar
        sessions={store.value.sessions}
        activeId={store.value.activeSessionId}
        loading={loading.value}
        open={sidebarOpen.value}
        memory={memoryEntries.value}
        view={view.value}
        onSelect={switchSession}
        onNew={newChat}
        onDelete={deleteChat}
        onClose={() => {
          sidebarOpen.value = false;
        }}
        onClearShortMemory={() => void handleClearShortMemory()}
        onViewChange={(v) => {
          view.value = v;
          sidebarOpen.value = false;
        }}
      />

      {view.value === "timetable"
        ? (
          <div class="chat-main">
            <TimetablePanel
              onBack={() => {
                view.value = "chat";
              }}
            />
          </div>
        )
        : view.value === "files"
        ? (
          <div class="chat-main">
            <FilesPanel
              onBack={() => {
                view.value = "chat";
              }}
            />
          </div>
        )
        : view.value === "todo"
        ? (
          <div class="chat-main">
            <TodoPanel
              onBack={() => {
                view.value = "chat";
              }}
            />
          </div>
        )
        : (
          <div class="chat-main">
            <header class="chat-header">
              <button
                type="button"
                class="sidebar-toggle"
                aria-label="Otwórz listę rozmów"
                onClick={() => {
                  sidebarOpen.value = true;
                }}
              >
                ☰
              </button>
              <div class="chat-header-text">
                <h1 class="chat-title">{session().title}</h1>
                <p class="chat-status">{status.value}</p>
              </div>
              <div class="chat-header-actions">
              <button
                type="button"
                class="chat-timetable-btn"
                aria-label="TODO"
                title="TODO"
                onClick={() => {
                  view.value = "todo";
                }}
              >
                ✅
              </button>
              <button
                type="button"
                class="chat-timetable-btn"
                aria-label="Pliki"
                title="Pliki"
                onClick={() => {
                  view.value = "files";
                }}
              >
                📁
              </button>
              <button
                type="button"
                class="chat-timetable-btn"
                aria-label="Plan lekcji"
                title="Plan lekcji"
                onClick={() => {
                  view.value = "timetable";
                }}
              >
                📅
              </button>
              </div>
            </header>

            <div class="chat-messages" role="log" aria-live="polite">
              {!messages.length && !loading.value && (
                <ChatEmpty
                  disabled={loading.value}
                  onPick={(prompt) => void send(prompt)}
                />
              )}
              {messages.map((m, i) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  onRetry={m.error && i === messages.length - 1
                    ? () => void retryLast()
                    : undefined}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            <ChatComposer
              text={input.value}
              loading={loading.value}
              pending={pending.value}
              onText={(v) => {
                input.value = v;
              }}
              onSend={() => void send()}
              onFiles={(files) => {
                if (!files || loading.value) return;
                pending.value = [...pending.value, ...Array.from(files).map(pendingFrom)];
              }}
              onRemovePending={(id) => {
                pending.value = pending.value.filter((p) => p.id !== id);
              }}
            />
          </div>
        )}
    </div>
  );
}
