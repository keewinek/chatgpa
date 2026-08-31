import { useRef } from "preact/hooks";
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

  return (
    <form
      class="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
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
          class="chat-input"
          rows={1}
          placeholder="Wyślij wiadomość lub plik…"
          value={text}
          onInput={(e) => onText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={loading}
        />
        <button
          class="chat-send"
          type="submit"
          disabled={loading || (!text.trim() && !pending.length)}
        >
          Wyślij
        </button>
      </div>
    </form>
  );
}
