import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import ChatBubble from "./ChatBubble.tsx";
import ChatComposer from "./ChatComposer.tsx";
import ChatEmpty from "./ChatEmpty.tsx";
import ChatSidebar from "./ChatSidebar.tsx";
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
  fetchModels,
  type PendingFile,
  pendingFrom,
  postChat,
  releasePending,
  uploadFile,
} from "../lib/chat-api.ts";
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

  function addAssistant(sess: ChatSession, message: StoredMessage, mem: string[]) {
    const updated = { ...sess, messages: [...sess.messages, message], updatedAt: Date.now() };
    setStore(updateStore(store.value, updated, mem));
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

  async function completeChat(history: StoredMessage[], memBefore: string[]) {
    const { ok, data } = await postChat(history, memBefore).catch((err) => ({
      ok: false,
      data: { error: err instanceof Error ? err.message : String(err) },
    }));

    const mem = Array.isArray(data.memory) ? data.memory : memBefore;
    if (!ok) {
      const detail = data.attempts?.map((a: { model: string; error?: string }) =>
        `${a.model}${a.error ? ` (${a.error})` : ""}`
      ).join(" → ");
      addAssistant(session(), {
        id: msgId(),
        role: "assistant",
        content: `${data.error ?? "Błąd AI"}${detail ? `\n\nPróby: ${detail}` : ""}`,
        error: true,
      }, mem);
      return;
    }

    if (!data.message?.content) {
      addAssistant(session(), {
        id: msgId(),
        role: "assistant",
        content: "Błąd: pusta odpowiedź API",
        error: true,
      }, mem);
      return;
    }

    addAssistant(session(), {
      id: msgId(),
      role: "assistant",
      content: data.message.content,
      model: data.model,
      provider: data.provider,
      toolResults: data.toolResults ?? [],
      attachments: data.message.attachments ?? data.attachments,
    }, mem);

    const ready = status.value.includes("modele");
    status.value = ready
      ? `Online · odpowiedź: ${data.model}${mem.length ? ` · ${mem.length} faktów` : ""}`
      : status.value;
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
        onSelect={switchSession}
        onNew={newChat}
        onDelete={deleteChat}
        onClose={() => {
          sidebarOpen.value = false;
        }}
        onClearMemory={clearStudentMemory}
      />

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
              onRetry={m.error && i === messages.length - 1 ? () => void retryLast() : undefined}
            />
          ))}
          {loading.value && (
            <article class="bubble bubble--assistant bubble--pending">
              <div class="bubble-role">ChatGPA</div>
              <div class="bubble-body thinking">Myślę…</div>
            </article>
          )}
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
    </div>
  );
}
