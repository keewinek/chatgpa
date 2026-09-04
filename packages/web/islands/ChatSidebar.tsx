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
  filesActive: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onClearShortMemory: () => void;
  onOpenFiles: () => void;
}

export default function ChatSidebar({
  sessions,
  activeId,
  loading,
  open,
  memory,
  filesActive,
  onSelect,
  onNew,
  onDelete,
  onClose,
  onClearShortMemory,
  onOpenFiles,
}: ChatSidebarProps) {
  const memoryOpen = useSignal(false);
  const memoryTab = useSignal<"short" | "long">("long");

  const shortEntries = memory.filter((e) => e.kind === "short");
  const longEntries = memory.filter((e) => e.kind === "long");
  const visible = memoryTab.value === "short" ? shortEntries : longEntries;
  const memoryCount = memory.length;

  return (
    <>
      <div
        class={`sidebar-backdrop${open ? " sidebar-backdrop--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside class={`sidebar${open ? " sidebar--open" : ""}`} aria-label="Historia rozmów">
        <div class="sidebar-top">
          <div class="sidebar-brand-row">
            <span class="sidebar-logo">ChatGPA</span>
            <button
              type="button"
              class={`sidebar-icon-btn${filesActive ? " sidebar-icon-btn--active" : ""}`}
              onClick={onOpenFiles}
              title="Pliki"
              aria-label="Pliki"
            >
              ◇
            </button>
          </div>
          <button class="sidebar-new" type="button" onClick={onNew} disabled={loading}>
            Nowa
          </button>
        </div>

        <nav class="sidebar-list" aria-label="Rozmowy">
          {sessions.length === 0 && <p class="sidebar-empty">Brak rozmów</p>}
          {sessions.map((session) => (
            <div
              key={session.id}
              class={`sidebar-item${
                !filesActive && session.id === activeId ? " sidebar-item--active" : ""
              }`}
            >
              <button
                type="button"
                class="sidebar-item-btn"
                onClick={() => onSelect(session.id)}
                disabled={loading}
              >
                <span class="sidebar-item-title">{session.title}</span>
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

        <div class={`sidebar-memory${memoryOpen.value ? " sidebar-memory--open" : ""}`}>
          <button
            type="button"
            class="sidebar-memory-toggle"
            aria-expanded={memoryOpen.value}
            onClick={() => {
              memoryOpen.value = !memoryOpen.value;
            }}
          >
            <span>Pamięć</span>
            <span class="sidebar-memory-count">{memoryCount || "—"}</span>
          </button>

          {memoryOpen.value && (
            <>
              <div class="sidebar-memory-tabs" role="tablist" aria-label="Rodzaj pamięci">
                <button
                  type="button"
                  role="tab"
                  aria-selected={memoryTab.value === "short"}
                  class={`sidebar-memory-tab${
                    memoryTab.value === "short" ? " sidebar-memory-tab--active" : ""
                  }`}
                  onClick={() => {
                    memoryTab.value = "short";
                  }}
                >
                  Krótka
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={memoryTab.value === "long"}
                  class={`sidebar-memory-tab${
                    memoryTab.value === "long" ? " sidebar-memory-tab--active" : ""
                  }`}
                  onClick={() => {
                    memoryTab.value = "long";
                  }}
                >
                  Długa
                </button>
                {memoryTab.value === "short" && shortEntries.length > 0 && (
                  <button
                    type="button"
                    class="sidebar-memory-clear"
                    disabled={loading}
                    onClick={onClearShortMemory}
                  >
                    Wyczyść
                  </button>
                )}
              </div>
              {visible.length === 0
                ? <p class="sidebar-memory-empty">Pusto</p>
                : (
                  <ul class="sidebar-memory-list">
                    {visible.map((entry) => (
                      <li key={entry.id} class="sidebar-memory-item">
                        <span class="sidebar-memory-content">{entry.content}</span>
                        {entry.expiresAt && (
                          <span class="sidebar-memory-expiry">
                            {formatExpiry(entry.expiresAt)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
