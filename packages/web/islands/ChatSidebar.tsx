import type { ChatSession } from "../lib/chat-storage.ts";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeId: string;
  loading: boolean;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function ChatSidebar({
  sessions,
  activeId,
  loading,
  open,
  onSelect,
  onNew,
  onDelete,
  onClose,
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
          <button
            class="sidebar-new"
            type="button"
            onClick={onNew}
            disabled={loading}
          >
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
                <span class="sidebar-item-date">
                  {formatSessionDate(session.updatedAt)}
                </span>
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

        <p class="sidebar-foot">Cursor do szkoły · darmowe AI</p>
      </aside>
    </>
  );
}

function formatSessionDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
