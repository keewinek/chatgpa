import { useEffect, useRef } from "preact/hooks";
import { ACCEPTED_FILES, type PendingFile, releasePending } from "../lib/chat-api.ts";

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
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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

  useEffect(() => {
    if (textRef.current) resizeTextarea(textRef.current);
  }, [text]);

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
        onSend();
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={onDrop}
    >
      {pending.length > 0 && (
        <div class="composer-attachments">
          {pending.map((p) => (
            <div key={p.id} class="composer-attachment">
              {p.preview
                ? <img class="composer-attachment-thumb" src={p.preview} alt={p.file.name} />
                : <span class="composer-attachment-icon">📄</span>}
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
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div class="composer-row">
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
          disabled={loading}
          onClick={() => fileRef.current?.click()}
        >
          📎
        </button>
        <textarea
          ref={textRef}
          class="chat-input"
          rows={1}
          placeholder="Wyślij wiadomość… (Enter wyślij, Shift+Enter nowa linia)"
          value={text}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            onText(el.value);
            resizeTextarea(el);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
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
        <button
          class="chat-send"
          type="submit"
          disabled={loading || (!text.trim() && !pending.length)}
        >
          {loading ? "…" : "Wyślij"}
        </button>
      </div>
    </form>
  );
}
