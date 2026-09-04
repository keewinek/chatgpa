import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { MemoryEntry } from "@chatgpa/core";
import ChatBubble from "./ChatBubble.tsx";
import ChatComposer from "./ChatComposer.tsx";
import ChatEmpty from "./ChatEmpty.tsx";
import ChatSidebar from "./ChatSidebar.tsx";
import FilesPanel from "./FilesPanel.tsx";
import PomodoroPanel from "./PomodoroPanel.tsx";
import NotificationsBanner from "./NotificationsBanner.tsx";
import NotificationPlanCard from "./NotificationPlanCard.tsx";
import Icon from "./Icon.tsx";
import ResizablePanels from "./ResizablePanels.tsx";
import {
  type ChatSession,
  type ChatStore,
  createEmptySession,
  createSessionFromNotification,
  deleteChatOnServer,
  getActiveSession,
  getLegacyMemoryFacts,
  initChatSync,
  markMemoryMigrated,
  pushChatToServer,
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
import { clearShortMemory, fetchMemory, migrateLegacyMemory } from "../lib/memory-api.ts";
import { loadGroupPrefs, loadGroupPrefsAsync } from "../lib/timetable-storage.ts";
import { parseSlashCommand } from "../lib/commands.ts";
import type { ChatAttachment } from "@chatgpa/core";
import {
  fetchLibrusStatus,
  formatLibrusSyncTime,
  triggerLibrusSyncViaExtension,
} from "../lib/librus-api.ts";
import {
  clearNotificationUrl,
  fetchNotification,
  fetchNotifications,
  markNotificationRead,
  notificationFromUrl,
  registerWebPush,
} from "../lib/notifications-api.ts";
import type { AppNotification } from "@chatgpa/core";
import { type UiView, viewFromSlash } from "../lib/ui-shortcuts.ts";

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
  const store = useSignal<ChatStore | null>(null);
  const memoryEntries = useSignal<MemoryEntry[]>([]);
  const input = useSignal("");
  const loading = useSignal(false);
  const status = useSignal("Łączenie…");
  const sidebarOpen = useSignal(false);
  const view = useSignal<"chat" | "files">("chat");
  const filesUi = useSignal<UiView | null>(null);
  const notesInitialPath = useSignal<string | null>(null);
  const pomodoroOpen = useSignal(false);
  const pending = useSignal<PendingFile[]>([]);
  const librusSyncedAt = useSignal<string | null>(null);
  const librusStale = useSignal(true);
  const librusSyncing = useSignal(false);
  const librusSyncError = useSignal<string | null>(null);
  const unreadNotifications = useSignal<AppNotification[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const session = () => store.value ? getActiveSession(store.value) : createEmptySession();
  const messages = session().messages;

  async function refreshNotifications() {
    try {
      unreadNotifications.value = await fetchNotifications(true);
    } catch {
      unreadNotifications.value = [];
    }
  }

  async function handleOpenNotification(notification: AppNotification) {
    if (loading.value || !store.value) return;

    const content = notification.chatPrefill?.content ?? notification.body;
    const s = createSessionFromNotification(
      notification.title,
      content,
      notification.payload?.todoToday && typeof notification.payload.freeMinutes === "number"
        ? {
          todoToday: notification.payload.todoToday,
          freeMinutes: notification.payload.freeMinutes,
        }
        : undefined,
    );

    const next = {
      ...store.value,
      activeSessionId: s.id,
      sessions: [s, ...store.value.sessions],
    };
    setStore(next);
    saveStore(next);
    void pushChatToServer(next, s.id);
    view.value = "chat";
    input.value = "";
    sidebarOpen.value = false;

    try {
      await markNotificationRead(notification.id);
    } catch {
      // ignore — chat still opens
    }
    unreadNotifications.value = unreadNotifications.value.filter((n) => n.id !== notification.id);
    clearNotificationUrl();
  }

  async function handleDismissNotification(id: string) {
    try {
      await markNotificationRead(id);
    } catch {
      // ignore
    }
    unreadNotifications.value = unreadNotifications.value.filter((n) => n.id !== id);
  }

  async function refreshMemory() {
    if (!store.value) return;
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

  async function refreshLibrusStatus() {
    try {
      const status = await fetchLibrusStatus();
      librusSyncedAt.value = status.syncedAt;
      librusStale.value = status.stale;
      librusSyncError.value = null;
    } catch {
      librusSyncedAt.value = null;
      librusStale.value = true;
    }
  }

  async function handleLibrusSync() {
    if (librusSyncing.value) return;
    librusSyncing.value = true;
    librusSyncError.value = null;
    try {
      const result = await triggerLibrusSyncViaExtension();
      librusSyncedAt.value = result.syncedAt;
      librusStale.value = false;
      void refreshMemory();
    } catch (err) {
      librusSyncError.value = err instanceof Error ? err.message : String(err);
    } finally {
      librusSyncing.value = false;
    }
  }

  useEffect(() => {
    void initChatSync().then((loaded) => {
      store.value = loaded;
      void refreshMemory();

      const notificationId = notificationFromUrl();
      if (notificationId) {
        void fetchNotification(notificationId)
          .then((n) => handleOpenNotification(n))
          .catch(() => clearNotificationUrl());
      }
    });
    void loadGroupPrefsAsync();
    void refreshLibrusStatus();
    void refreshNotifications();
    void registerWebPush().catch(() => undefined);

    const poll = globalThis.setInterval(() => void refreshNotifications(), 60_000);
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
    return () => globalThis.clearInterval(poll);
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
    if (loading.value || !store.value) return;
    if (id === store.value.activeSessionId && view.value === "chat") return;
    setStore({ ...store.value, activeSessionId: id });
    saveStore(store.value);
    view.value = "chat";
    input.value = "";
    sidebarOpen.value = false;
  }

  function newChat() {
    if (loading.value || !store.value) return;
    const s = createEmptySession();
    const next = { ...store.value, activeSessionId: s.id, sessions: [s, ...store.value.sessions] };
    setStore(next);
    saveStore(next);
    void pushChatToServer(next, s.id);
    view.value = "chat";
    input.value = "";
    sidebarOpen.value = false;
  }

  function deleteChat(id: string) {
    if (loading.value || !store.value) return;
    void deleteChatOnServer(id);
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

    const slash = text ? parseSlashCommand(text) : null;

    if (slash?.type === "ui") {
      input.value = "";
      sidebarOpen.value = false;
      if (slash.command === "pomodoro") {
        pomodoroOpen.value = true;
        return;
      }
      if (slash.command === "files") {
        filesUi.value = null;
        notesInitialPath.value = null;
        view.value = "files";
        return;
      }
      const ui = viewFromSlash(slash.command);
      if (ui) {
        if (slash.command === "notes") {
          notesInitialPath.value = slash.notesPath ?? null;
        } else {
          notesInitialPath.value = null;
        }
        filesUi.value = ui;
        view.value = "files";
        return;
      }
    }

    if (slash?.type === "api" && slash.command === "clear-short-memory") {
      if (!store.value) return;
      input.value = "";
      memoryEntries.value = await clearShortMemory();
      const current = { ...session() };
      current.messages = [
        ...current.messages,
        {
          id: msgId(),
          role: "assistant",
          content: slash.confirmMessage,
        },
      ];
      current.updatedAt = Date.now();
      setStore(updateStore(store.value, current));
      return;
    }

    if (!store.value) return;
    const chatStore = store.value;

    const promptSeed = slash?.type === "prompt" ? slash.seed : undefined;
    const displayText = slash?.type === "prompt" ? slash.display : text;

    if (text === "/calendar" || text.startsWith("/calendar ")) {
      filesUi.value = "calendar";
      notesInitialPath.value = null;
      view.value = "files";
      input.value = "";
      sidebarOpen.value = false;
      return;
    }

    if (text === "/profile" || text.startsWith("/profile ")) {
      filesUi.value = "profile";
      notesInitialPath.value = null;
      view.value = "files";
      input.value = "";
      sidebarOpen.value = false;
      return;
    }

    if (text === "/timetable" || text.startsWith("/timetable ")) {
      filesUi.value = "timetable";
      notesInitialPath.value = null;
      view.value = "files";
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
        content: displayText || "Przesłane pliki.",
        attachments: attachments.length ? attachments : undefined,
      },
    ];
    current.updatedAt = Date.now();
    if (current.title === "Nowa rozmowa" && displayText) {
      current.title = titleFromText(displayText);
    }
    setStore(updateStore(chatStore, current));
    if (!overrideText) input.value = "";
    loading.value = true;

    const legacyFacts = getLegacyMemoryFacts(chatStore);
    const history = current.messages.filter((m) => !m.error);
    const apiHistory = promptSeed
      ? history.map((m, i) =>
        i === history.length - 1 && m.role === "user" ? { ...m, content: promptSeed } : m
      )
      : history;
    await completeChat(apiHistory, legacyFacts);
    loading.value = false;
  }

  function patchMessage(id: string, patch: Partial<StoredMessage>) {
    if (!store.value) return;
    const s = session();
    const messages = s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setStore(updateStore(store.value, { ...s, messages, updatedAt: Date.now() }));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function completeChat(history: StoredMessage[], legacyFacts: string[]) {
    if (!store.value) return;
    const chatStore = store.value;
    const assistantId = msgId();
    const s = session();
    setStore(updateStore(chatStore, {
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
        if (!store.value) return;
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
        setStore(updateStore(chatStore, { ...s, messages, updatedAt: Date.now() }));
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
        setStore(updateStore(chatStore, { ...s, messages, updatedAt: Date.now() }));
        memoryEntries.value = event.memory;
        status.value = `Online · odpowiedź: ${event.model}${memorySummary(event.memory)}`;
        void pushChatToServer(chatStore);
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  async function retryLast() {
    if (loading.value || !store.value) return;
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

  if (!store.value) {
    return (
      <div class="chat-app chat-app--loading">
        <p class="chat-status">Ładowanie historii czatów…</p>
      </div>
    );
  }

  return (
    <div class="chat-app">
      <ResizablePanels
        storageKey="chat-sidebar"
        class="chat-app-split"
        defaultSize={216}
        minSize={180}
        maxSize={360}
        handleLabel="Zmień szerokość listy rozmów"
      >
        <ChatSidebar
          sessions={store.value.sessions}
          activeId={store.value.activeSessionId}
          loading={loading.value}
          open={sidebarOpen.value}
          memory={memoryEntries.value}
          filesActive={view.value === "files"}
          onSelect={switchSession}
          onNew={newChat}
          onDelete={deleteChat}
          onClose={() => {
            sidebarOpen.value = false;
          }}
          onClearShortMemory={() => void handleClearShortMemory()}
          onOpenFiles={() => {
            filesUi.value = null;
            notesInitialPath.value = null;
            view.value = "files";
            sidebarOpen.value = false;
          }}
        />

        {view.value === "files"
          ? (
            <div class="chat-main">
              <FilesPanel
                initialUi={filesUi.value}
                notesInitialPath={notesInitialPath.value}
                onInitialUiConsumed={() => {
                  filesUi.value = null;
                }}
                onOpenPomodoro={() => {
                  pomodoroOpen.value = true;
                }}
                onBack={() => {
                  view.value = "chat";
                  filesUi.value = null;
                  notesInitialPath.value = null;
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
                  <Icon name="bars" />
                </button>
                <div class="chat-header-text">
                  <h1 class="chat-title">{session().title}</h1>
                </div>
                <div class="chat-header-actions">
                  <button
                    type="button"
                    class="chat-icon-btn"
                    aria-label="Pliki"
                    title="Pliki"
                    onClick={() => {
                      filesUi.value = null;
                      notesInitialPath.value = null;
                      view.value = "files";
                    }}
                  >
                    <Icon name="folder" />
                  </button>
                  <button
                    type="button"
                    class="chat-icon-btn"
                    aria-label="Powiadomienia"
                    title="Powiadomienia"
                    onClick={() => {
                      if (unreadNotifications.value[0]) {
                        void handleOpenNotification(unreadNotifications.value[0]);
                      }
                    }}
                  >
                    <Icon name="bell" />
                    {unreadNotifications.value.length > 0 && (
                      <span class="chat-icon-badge">{unreadNotifications.value.length}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    class={`chat-icon-btn${librusStale.value ? " chat-icon-btn--warn" : ""}`}
                    aria-label="Sync Librus"
                    title={librusSyncError.value ??
                      (librusSyncedAt.value
                        ? `Librus: ${formatLibrusSyncTime(librusSyncedAt.value)}`
                        : "Sync Librus")}
                    disabled={loading.value || librusSyncing.value}
                    onClick={() => void handleLibrusSync()}
                  >
                    <Icon
                      name={librusSyncing.value ? "spinner" : "arrows-rotate"}
                      class={librusSyncing.value ? "fa-spin" : undefined}
                    />
                  </button>
                  <button
                    type="button"
                    class="chat-icon-btn"
                    aria-label="Pomodoro"
                    title="Pomodoro"
                    onClick={() => {
                      pomodoroOpen.value = true;
                    }}
                  >
                    <Icon name="stopwatch" />
                  </button>
                </div>
              </header>

              <div class="chat-body">
                <NotificationsBanner
                  notifications={unreadNotifications.value}
                  onOpen={(n) => void handleOpenNotification(n)}
                  onDismiss={(id) => void handleDismissNotification(id)}
                />

                <div class="chat-messages" role="log" aria-live="polite">
                  {session().notificationContext && (
                    <NotificationPlanCard
                      todoToday={session().notificationContext!.todoToday}
                      freeMinutes={session().notificationContext!.freeMinutes}
                    />
                  )}
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
      </ResizablePanels>

      {pomodoroOpen.value && (
        <PomodoroPanel
          onClose={() => {
            pomodoroOpen.value = false;
          }}
        />
      )}
    </div>
  );
}
