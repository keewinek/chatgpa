import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import ChatBubble from "./ChatBubble.tsx";
import ChatComposer from "./ChatComposer.tsx";
import ChatEmpty from "./ChatEmpty.tsx";
import ChatSidebar from "./ChatSidebar.tsx";
import TimetablePanel from "./TimetablePanel.tsx";
import {
  type ChatSession,
  type ChatStore,
  clearMemory,
  createEmptySession,
  getActiveSession,
  loadStore,
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
import { loadGroupPrefs } from "../lib/timetable-storage.ts";
import type { ChatAttachment } from "@chatgpa/core";

function msgId() {
  return sessionId();
}

function updateStore(store: ChatStore, session: ChatSession, memory: string[]) {
  const next = upsertSession({ ...store, memory }, session);
  saveStore(next);
  return next;
}

export default function ChatApp() {
  const store = useSignal<ChatStore>(loadStore());
  const input = useSignal("");
  const loading = useSignal(false);
  const status = useSignal("Łączenie…");
  const sidebarOpen = useSignal(false);
  const view = useSignal<"chat" | "timetable">("chat");
  const pending = useSignal<PendingFile[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const session = () => getActiveSession(store.value);
  const memory = () => store.value.memory;
  const messages = session().messages;

  useEffect(() => {
    fetchModels()
      .then(({ models }) => {
        const ready = models.filter((m) => m.configured);
        const mem = memory().length ? ` · ${memory().length} faktów` : "";
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

  function clearStudentMemory() {
    const next = clearMemory(store.value);
    setStore(next);
    saveStore(next);
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input.value).trim();
    if ((!text && !pending.value.length) || loading.value) return;

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
    setStore(updateStore(store.value, current, memory()));
    if (!overrideText) input.value = "";
    loading.value = true;

    await completeChat(current.messages.filter((m) => !m.error), memory());
    loading.value = false;
  }

  function patchMessage(id: string, patch: Partial<StoredMessage>) {
    const s = session();
    const messages = s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setStore(
      updateStore(store.value, { ...s, messages, updatedAt: Date.now() }, store.value.memory),
    );
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function completeChat(history: StoredMessage[], memBefore: string[]) {
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
    }, memBefore));

    await streamChat(history, memBefore, loadGroupPrefs(), (event: ChatStreamEvent) => {
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
        setStore(updateStore(store.value, { ...s, messages, updatedAt: Date.now() }, event.memory));
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
        setStore(updateStore(store.value, { ...s, messages, updatedAt: Date.now() }, event.memory));
        status.value = `Online · odpowiedź: ${event.model}${
          event.memory.length ? ` · ${event.memory.length} faktów` : ""
        }`;
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
    setStore(updateStore(store.value, updated, memory()));
    loading.value = true;
    await completeChat(msgs.filter((m) => !m.error), memory());
    loading.value = false;
  }

  return (
    <div class="chat-app">
      <ChatSidebar
        sessions={store.value.sessions}
        activeId={store.value.activeSessionId}
        loading={loading.value}
        open={sidebarOpen.value}
        memory={memory()}
        view={view.value}
        onSelect={switchSession}
        onNew={newChat}
        onDelete={deleteChat}
        onClose={() => {
          sidebarOpen.value = false;
        }}
        onClearMemory={clearStudentMemory}
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
