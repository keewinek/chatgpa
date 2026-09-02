import { useSignal } from "@preact/signals";
import type { MemoryEntry } from "@chatgpa/core";
import type { ChatSession } from "../lib/chat-storage.ts";
import { formatExpiry } from "../lib/memory-api.ts";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeId: string;
  loading: boolean;
  open: boolean;
  memory: MemoryEntry[];
  view: "chat" | "timetable" | "files" | "todo";
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClearShortMemory: () => void;
  onViewChange: (view: "chat" | "timetable" | "files" | "todo") => void;
}

export default function ChatSidebar({
  sessions,
  activeId,
  loading,
  open,
  memory,
  view,
  onSelect,
  onNew,
  onDelete,
  onClose,
  onClearShortMemory,
  onViewChange,
}: ChatSidebarProps) {
  const memoryTab = useSignal<"short" | "long">("long");

  const shortEntries = memory.filter((e) => e.kind === "short");
  const longEntries = memory.filter((e) => e.kind === "long");
  const visible = memoryTab.value === "short" ? shortEntries : longEntries;

  return (
    <>
      <div
        class={`sidebar-backdrop${open ? " sidebar-backdrop--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside class={`sidebar${open ? " sidebar--open" : ""}`} aria-label="Historia rozmów">
        <div class="sidebar-top">
          <span class="sidebar-logo">ChatGPA</span>
          <nav class="sidebar-nav" aria-label="Nawigacja">
            <button
              type="button"
              class={`sidebar-nav-btn${view === "chat" ? " sidebar-nav-btn--active" : ""}`}
              onClick={() => onViewChange("chat")}
            >
              💬 Czat
            </button>
            <button
              type="button"
              class={`sidebar-nav-btn${view === "timetable" ? " sidebar-nav-btn--active" : ""}`}
              onClick={() => onViewChange("timetable")}
            >
              📅 Plan lekcji
            </button>
            <button
              type="button"
              class={`sidebar-nav-btn${view === "todo" ? " sidebar-nav-btn--active" : ""}`}
              onClick={() => onViewChange("todo")}
            >
              ✅ TODO
            </button>
            <button
              type="button"
              class={`sidebar-nav-btn${view === "files" ? " sidebar-nav-btn--active" : ""}`}
              onClick={() => onViewChange("files")}
            >
              📁 Pliki
            </button>
          </nav>
          <button class="sidebar-new" type="button" onClick={onNew} disabled={loading}>
            + Nowa rozmowa
          </button>
        </div>

        <nav class="sidebar-list" aria-label="Rozmowy">
          {sessions.length === 0 && <p class="sidebar-empty">Brak rozmów</p>}
          {sessions.map((session) => (
            <div
              key={session.id}
              class={`sidebar-item${session.id === activeId ? " sidebar-item--active" : ""}`}
            >
              <button
                type="button"
                class="sidebar-item-btn"
                onClick={() => onSelect(session.id)}
                disabled={loading}
              >
                <span class="sidebar-item-title">{session.title}</span>
                <span class="sidebar-item-date">{formatSessionDate(session.updatedAt)}</span>
              </button>
              <button
                type="button"
                class="sidebar-item-delete"
                title="Usuń rozmowę"
                aria-label="Usuń rozmowę"
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(session.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </nav>

        <div class="sidebar-memory">
          <div class="sidebar-memory-head">
            <span class="sidebar-memory-title">Pamięć</span>
            {memoryTab.value === "short" && shortEntries.length > 0 && (
              <button
                type="button"
                class="sidebar-memory-clear"
                disabled={loading}
                onClick={onClearShortMemory}
              >
                Wyczyść krótką
              </button>
            )}
          </div>
          <div class="sidebar-memory-tabs" role="tablist" aria-label="Rodzaj pamięci">
            <button
              type="button"
              role="tab"
              aria-selected={memoryTab.value === "short"}
              class={`sidebar-memory-tab${memoryTab.value === "short" ? " sidebar-memory-tab--active" : ""}`}
              onClick={() => {
                memoryTab.value = "short";
              }}
            >
              Krótka ({shortEntries.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={memoryTab.value === "long"}
              class={`sidebar-memory-tab${memoryTab.value === "long" ? " sidebar-memory-tab--active" : ""}`}
              onClick={() => {
                memoryTab.value = "long";
              }}
            >
              Długa ({longEntries.length})
            </button>
          </div>
          {visible.length === 0
            ? (
              <p class="sidebar-memory-empty">
                {memoryTab.value === "short" ? "Brak krótkiej pamięci" : "Brak długiej pamięci"}
              </p>
            )
            : (
              <ul class="sidebar-memory-list">
                {visible.map((entry) => (
                  <li key={entry.id} class="sidebar-memory-item">
                    <span class="sidebar-memory-content">{entry.content}</span>
                    {entry.expiresAt && (
                      <span class="sidebar-memory-expiry">
                        wygasa: {formatExpiry(entry.expiresAt)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </div>

        <p class="sidebar-foot">Cursor do szkoły · darmowe AI</p>
      </aside>
    </>
  );
}

function formatSessionDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
