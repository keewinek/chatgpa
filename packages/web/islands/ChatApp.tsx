import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import ChatBubble from "./ChatBubble.tsx";
import ChatComposer from "./ChatComposer.tsx";
import ChatSidebar from "./ChatSidebar.tsx";
import {
  type ChatSession,
  type ChatStore,
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
  const status = useSignal("Sprawdzam modele…");
  const sidebarOpen = useSignal(false);
  const pending = useSignal<PendingFile[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const session = () => getActiveSession(store.value);
  const memory = () => store.value.memory;

  useEffect(() => {
    fetchModels()
      .then(({ models }) => {
        const ready = models.filter((m) => m.configured);
        const mem = memory().length ? ` · pamięć: ${memory().length} faktów` : "";
        status.value = ready.length
          ? `${ready.length} slotów · ${ready.map((m) => m.label).join(" → ")}${mem}`
          : "Brak kluczy AI — dodaj GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY do .env.";
      })
      .catch(() => {
        status.value = "API niedostępne — uruchom `deno task dev`.";
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  });

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

  function addAssistant(session: ChatSession, message: StoredMessage, mem: string[]) {
    const updated = { ...session, messages: [...session.messages, message], updatedAt: Date.now() };
    setStore(updateStore(store.value, updated, mem));
  }

  async function send() {
    const text = input.value.trim();
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
    input.value = "";
    loading.value = true;

    const history = current.messages.filter((m) => !m.error);
    const { ok, data } = await postChat(history, memory()).catch((err) => ({
      ok: false,
      data: { error: err instanceof Error ? err.message : String(err) },
    }));

    const mem = Array.isArray(data.memory) ? data.memory : memory();
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
    } else if (data.message?.content) {
      addAssistant(session(), {
        id: msgId(),
        role: "assistant",
        content: data.message.content,
        model: data.model,
        provider: data.provider,
        toolResults: data.toolResults ?? [],
        attachments: data.message.attachments ?? data.attachments,
      }, mem);
    } else {
      addAssistant(session(), {
        id: msgId(),
        role: "assistant",
        content: "Błąd: pusta odpowiedź API",
        error: true,
      }, mem);
    }
    loading.value = false;
  }

  const messages = session().messages;

  return (
    <div class="chat-app">
      <ChatSidebar
        sessions={store.value.sessions}
        activeId={store.value.activeSessionId}
        loading={loading.value}
        open={sidebarOpen.value}
        onSelect={switchSession}
        onNew={newChat}
        onDelete={deleteChat}
        onClose={() => {
          sidebarOpen.value = false;
        }}
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
            <div class="chat-empty">
              <p class="chat-empty-title">Cześć — tu ChatGPA</p>
              <p class="chat-empty-hint">
                Zapytaj o naukę, plan dnia albo poproś o quiz. Odpowiadam w Markdown i mogę
                zapamiętać fakty o Tobie.
              </p>
            </div>
          )}
          {messages.map((m) => <ChatBubble key={m.id} message={m} />)}
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
