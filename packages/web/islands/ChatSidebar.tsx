import type { ChatSession } from "../lib/chat-storage.ts";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeId: string;
  loading: boolean;
  open: boolean;
  memory: string[];
  view: "chat" | "timetable";
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClearMemory: () => void;
  onViewChange: (view: "chat" | "timetable") => void;
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
  onClearMemory,
  onViewChange,
}: ChatSidebarProps) {
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

        {memory.length > 0 && (
          <div class="sidebar-memory">
            <div class="sidebar-memory-head">
              <span class="sidebar-memory-title">Pamięć</span>
              <button
                type="button"
                class="sidebar-memory-clear"
                disabled={loading}
                onClick={onClearMemory}
              >
                Wyczyść
              </button>
            </div>
            <ul class="sidebar-memory-list">
              {memory.map((fact, i) => (
                <li key={`${i}-${fact}`} class="sidebar-memory-item">{fact}</li>
              ))}
            </ul>
          </div>
        )}

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
