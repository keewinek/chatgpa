import { useEffect, useRef, useState } from "preact/hooks";
import { ACCEPTED_FILES, type PendingFile, releasePending } from "../lib/chat-api.ts";
import { type CommandEntry, filterCommands } from "../lib/commands.ts";
import Icon from "./Icon.tsx";

interface ChatComposerProps {
  text: string;
  loading: boolean;
  pending: PendingFile[];
  onText: (value: string) => void;
  onSend: () => void;
  onFiles: (files: FileList | null) => void;
  onRemovePending: (id: string) => void;
}

function resizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

export default function ChatComposer({
  text,
  loading,
  pending,
  onText,
  onSend,
  onFiles,
  onRemovePending,
}: ChatComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<CommandEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const showSuggestions = suggestions.length > 0 && text.startsWith("/") && !text.includes("\n");
  const canSend = !loading && (Boolean(text.trim()) || pending.length > 0);

  useEffect(() => {
    if (textRef.current) resizeTextarea(textRef.current);
  }, [text]);

  useEffect(() => {
    if (!text.startsWith("/") || text.includes("\n")) {
      setSuggestions([]);
      setSelectedIdx(0);
      return;
    }
    const matches = filterCommands(text);
    setSuggestions(matches);
    setSelectedIdx(0);
  }, [text]);

  function applySuggestion(entry: CommandEntry) {
    onText(entry.trigger);
    setSuggestions([]);
    setSelectedIdx(0);
    textRef.current?.focus();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (loading) return;
    const dt = e.dataTransfer;
    if (dt?.files?.length) onFiles(dt.files);
  }

  return (
    <form
      class="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (showSuggestions && suggestions[selectedIdx]) {
          applySuggestion(suggestions[selectedIdx]);
          return;
        }
        onSend();
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={onDrop}
    >
      <div class={`composer-shell${canSend ? " composer-shell--ready" : ""}`}>
        {pending.length > 0 && (
          <div class="composer-attachments">
            {pending.map((p) => (
              <div key={p.id} class="composer-attachment">
                {p.preview
                  ? <img class="composer-attachment-thumb" src={p.preview} alt={p.file.name} />
                  : (
                    <span class="composer-attachment-icon">
                      <Icon name="file" />
                    </span>
                  )}
                <span class="composer-attachment-name">{p.file.name}</span>
                <button
                  type="button"
                  class="composer-attachment-remove"
                  aria-label="Usuń plik"
                  onClick={() => {
                    releasePending(p);
                    onRemovePending(p.id);
                  }}
                >
                  <Icon name="xmark" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showSuggestions && (
          <ul class="command-autocomplete" role="listbox" aria-label="Komendy slash">
            {suggestions.map((entry, i) => (
              <li key={entry.id} role="option" aria-selected={i === selectedIdx}>
                <button
                  type="button"
                  class={`command-autocomplete-item${
                    i === selectedIdx ? " command-autocomplete-item--active" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(entry);
                  }}
                >
                  <span class="command-autocomplete-trigger">{entry.trigger}</span>
                  <span class="command-autocomplete-desc">{entry.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          ref={textRef}
          class="chat-input"
          rows={1}
          placeholder="Zapytaj agenta…"
          value={text}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            onText(el.value);
            resizeTextarea(el);
          }}
          onKeyDown={(e) => {
            if (showSuggestions) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Tab" && suggestions[selectedIdx]) {
                e.preventDefault();
                applySuggestion(suggestions[selectedIdx]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setSuggestions([]);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (showSuggestions && suggestions[selectedIdx]) {
                applySuggestion(suggestions[selectedIdx]);
                return;
              }
              onSend();
            }
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (const item of items) {
              if (item.kind === "file") {
                const f = item.getAsFile();
                if (f) files.push(f);
              }
            }
            if (files.length) {
              e.preventDefault();
              const dt = new DataTransfer();
              for (const f of files) dt.items.add(f);
              onFiles(dt.files);
            }
          }}
          disabled={loading}
        />

        <div class="composer-toolbar">
          <input
            ref={fileRef}
            type="file"
            class="composer-file-input"
            accept={ACCEPTED_FILES}
            multiple
            onChange={(e) => onFiles((e.target as HTMLInputElement).files)}
          />
          <button
            type="button"
            class="composer-file-btn"
            aria-label="Dodaj plik"
            title="Dodaj plik"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="plus" />
          </button>
          <span class="composer-hint">
            <kbd>/</kbd> komendy
            <span class="composer-hint-sep">·</span>
            Enter wyślij
          </span>
          <button
            class={`chat-send${canSend ? " chat-send--ready" : ""}`}
            type="submit"
            disabled={!canSend}
            aria-label={loading ? "Wysyłanie" : "Wyślij"}
            title="Wyślij"
          >
            <Icon name={loading ? "spinner" : "arrow-up"} class={loading ? "fa-spin" : undefined} />
          </button>
        </div>
      </div>
    </form>
  );
}
