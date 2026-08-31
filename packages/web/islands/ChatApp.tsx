import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import MarkdownBody from "./MarkdownBody.tsx";
import ChatSidebar from "./ChatSidebar.tsx";
import MessageAttachments from "./MessageAttachments.tsx";
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
  ACCEPTED_FILE_TYPES,
  createPendingFile,
  type PendingFile,
  releasePendingFile,
  uploadFile,
} from "../lib/file-upload.ts";
import type { ChatAttachment } from "@chatgpa/core";

const API_BASE = "";

function uid() {
  return sessionId();
}

export default function ChatApp() {
  const store = useSignal<ChatStore>(loadStore());
  const input = useSignal("");
  const loading = useSignal(false);
  const status = useSignal("Sprawdzam modele…");
  const sidebarOpen = useSignal(false);
  const pendingFiles = useSignal<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = () => getActiveSession(store.value);
  const messages = () => active().messages;
  const memory = () => store.value.memory;

  useEffect(() => {
    fetch(`${API_BASE}/api/ai/models`)
      .then((r) => r.json())
      .then((data: { models: Array<{ configured: boolean; label: string }> }) => {
        const ready = data.models.filter((m) => m.configured);
        const memCount = memory().length;
        const memNote = memCount > 0 ? ` · pamięć: ${memCount} faktów` : "";
        if (ready.length === 0) {
          status.value =
            "Brak kluczy AI — dodaj GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY do .env.";
        } else {
          status.value = `${ready.length} slotów · kaskada: ${
            ready.map((m) => m.label).join(" → ")
          }${memNote}`;
        }
      })
      .catch(() => {
        status.value = "API niedostępne — uruchom `deno task dev`.";
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  function persist(session: ChatSession, memoryFacts: string[]) {
    const next = upsertSession(
      { ...store.value, memory: memoryFacts },
      session,
    );
    store.value = next;
    saveStore(next);
  }

  function switchSession(id: string) {
    if (loading.value || id === store.value.activeSessionId) return;
    store.value = { ...store.value, activeSessionId: id };
    saveStore(store.value);
    input.value = "";
    sidebarOpen.value = false;
  }

  function newChat() {
    if (loading.value) return;
    const session = createEmptySession();
    const next: ChatStore = {
      ...store.value,
      activeSessionId: session.id,
      sessions: [session, ...store.value.sessions],
    };
    store.value = next;
    saveStore(next);
    input.value = "";
    sidebarOpen.value = false;
  }

  function deleteChat(id: string) {
    if (loading.value) return;
    const remaining = store.value.sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const session = createEmptySession();
      const next: ChatStore = {
        ...store.value,
        activeSessionId: session.id,
        sessions: [session],
      };
      store.value = next;
      saveStore(next);
      input.value = "";
      sidebarOpen.value = false;
      return;
    }
    const activeSessionId = store.value.activeSessionId === id
      ? remaining[0].id
      : store.value.activeSessionId;
    const next: ChatStore = { ...store.value, sessions: remaining, activeSessionId };
    store.value = next;
    saveStore(next);
  }

  function removePending(localId: string) {
    const item = pendingFiles.value.find((p) => p.localId === localId);
    if (item) releasePendingFile(item);
    pendingFiles.value = pendingFiles.value.filter((p) => p.localId !== localId);
  }

  function onFilesSelected(fileList: FileList | null) {
    if (!fileList || loading.value) return;
    const next = [...pendingFiles.value];
    for (const file of Array.from(fileList)) {
      next.push(createPendingFile(file));
    }
    pendingFiles.value = next;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    const text = input.value.trim();
    const hasFiles = pendingFiles.value.length > 0;
    if ((!text && !hasFiles) || loading.value) return;

    const session = { ...active() };
    let attachments: ChatAttachment[] = [];

    if (hasFiles) {
      try {
        attachments = await Promise.all(
          pendingFiles.value.map((pending) => uploadFile(pending.file)),
        );
      } catch (err) {
        status.value = err instanceof Error ? err.message : String(err);
        return;
      }
      for (const pending of pendingFiles.value) releasePendingFile(pending);
      pendingFiles.value = [];
    }

    const userMsg: StoredMessage = {
      id: uid(),
      role: "user",
      content: text || (attachments.length > 0 ? "Przesłane pliki." : ""),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    session.messages = [...session.messages, userMsg];
    session.updatedAt = Date.now();
    if (session.title === "Nowa rozmowa") session.title = titleFromText(text);
    persist(session, memory());
    input.value = "";
    loading.value = true;

    const history = session.messages
      .filter((m) => !m.error)
      .map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, memory: memory() }),
      });
      const data = await res.json();
      const updated = { ...getActiveSession(store.value) };

      if (!res.ok) {
        const detail = data.attempts?.length
          ? `\n\nPróby: ${
            data.attempts
              .map((a: { model: string; error?: string }) =>
                `${a.model}${a.error ? ` (${a.error})` : ""}`
              )
              .join(" → ")
          }`
          : "";
        updated.messages = [
          ...updated.messages,
          {
            id: uid(),
            role: "assistant",
            content: `${data.error ?? "Błąd AI"}${detail}`,
            error: true,
          },
        ];
        persist(updated, Array.isArray(data.memory) ? data.memory : memory());
      } else {
        updated.messages = [
          ...updated.messages,
          {
            id: uid(),
            role: "assistant",
            content: data.message.content,
            model: data.model,
            provider: data.provider,
            toolResults: data.toolResults ?? [],
            attachments: data.message.attachments ?? data.attachments,
          },
        ];
        updated.updatedAt = Date.now();
        persist(updated, Array.isArray(data.memory) ? data.memory : memory());
      }
    } catch (err) {
      const updated = { ...getActiveSession(store.value) };
      updated.messages = [
        ...updated.messages,
        {
          id: uid(),
          role: "assistant",
          content: `Nie udało się połączyć z API: ${
            err instanceof Error ? err.message : String(err)
          }`,
          error: true,
        },
      ];
      persist(updated, memory());
    } finally {
      loading.value = false;
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const sessionMessages = messages();
  const isEmpty = sessionMessages.length === 0;

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
            <h1 class="chat-title">{active().title}</h1>
            <p class="chat-status">{status.value}</p>
          </div>
        </header>

        <div class="chat-messages" role="log" aria-live="polite">
          {isEmpty && !loading.value && (
            <div class="chat-empty">
              <p class="chat-empty-title">Cześć — tu ChatGPA</p>
              <p class="chat-empty-hint">
                Zapytaj o naukę, plan dnia albo poproś o quiz. Odpowiadam w Markdown i mogę
                zapamiętać fakty o Tobie.
              </p>
            </div>
          )}

          {sessionMessages.map((m) => (
            <article
              key={m.id}
              class={`bubble bubble--${m.role}${m.error ? " bubble--error" : ""}`}
            >
              <div class="bubble-role">
                {m.role === "user" ? "Ty" : "ChatGPA"}
              </div>
              {m.role === "assistant" && !m.error
                ? <MarkdownBody content={m.content} />
                : <div class="bubble-body">{m.content}</div>}
              {m.attachments && m.attachments.length > 0 && (
                <MessageAttachments attachments={m.attachments} />
              )}
              {m.toolResults && m.toolResults.length > 0 && (
                <div class="bubble-tools">
                  {m.toolResults.map((t, i) => (
                    <span
                      key={`${m.id}-tool-${i}`}
                      class={`tool-chip${t.ok ? " tool-chip--ok" : " tool-chip--err"}`}
                    >
                      {t.ok ? t.output ?? t.tool : `${t.tool}: ${t.error}`}
                    </span>
                  ))}
                </div>
              )}
              {m.role === "assistant" && m.model && (
                <div class="bubble-meta">
                  model: <code>{m.provider}/{m.model}</code>
                </div>
              )}
            </article>
          ))}

          {loading.value && (
            <article class="bubble bubble--assistant bubble--pending">
              <div class="bubble-role">ChatGPA</div>
              <div class="bubble-body thinking">Myślę (kaskada + narzędzia)…</div>
            </article>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          class="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {pendingFiles.value.length > 0 && (
            <div class="composer-attachments">
              {pendingFiles.value.map((pending) => (
                <div key={pending.localId} class="composer-attachment">
                  {pending.previewUrl
                    ? (
                      <img
                        class="composer-attachment-thumb"
                        src={pending.previewUrl}
                        alt={pending.file.name}
                      />
                    )
                    : <span class="composer-attachment-icon">📄</span>}
                  <span class="composer-attachment-name">{pending.file.name}</span>
                  <button
                    type="button"
                    class="composer-attachment-remove"
                    aria-label="Usuń plik"
                    onClick={() =>
                      removePending(pending.localId)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div class="composer-row">
            <input
              ref={fileInputRef}
              type="file"
              class="composer-file-input"
              accept={ACCEPTED_FILE_TYPES}
              multiple
              onChange={(e) => onFilesSelected((e.target as HTMLInputElement).files)}
            />
            <button
              type="button"
              class="composer-file-btn"
              aria-label="Dodaj plik"
              disabled={loading.value}
              onClick={() => fileInputRef.current?.click()}
            >
              📎
            </button>
            <textarea
              class="chat-input"
              rows={1}
              placeholder="Wyślij wiadomość lub plik…"
              value={input.value}
              onInput={(e) => {
                input.value = (e.target as HTMLTextAreaElement).value;
              }}
              onKeyDown={onKeyDown}
              disabled={loading.value}
            />
            <button
              class="chat-send"
              type="submit"
              disabled={loading.value || (!input.value.trim() && pendingFiles.value.length === 0)}
            >
              Wyślij
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
