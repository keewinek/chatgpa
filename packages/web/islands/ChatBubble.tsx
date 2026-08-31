import MarkdownBody from "./MarkdownBody.tsx";
import MessageAttachments from "./MessageAttachments.tsx";
import type { StoredMessage } from "../lib/chat-storage.ts";

interface ChatBubbleProps {
  message: StoredMessage;
  onRetry?: () => void;
}

export default function ChatBubble({ message, onRetry }: ChatBubbleProps) {
  const role = message.role === "user" ? "Ty" : "ChatGPA";
  const isAssistant = message.role === "assistant" && !message.error;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // ignore
    }
  }

  return (
    <article
      class={`bubble bubble--${message.role}${message.error ? " bubble--error" : ""}${
        message.streaming ? " bubble--streaming" : ""
      }`}
    >
      <div class="bubble-head">
        <div class="bubble-role">{role}</div>
        <div class="bubble-actions">
          {isAssistant && !message.streaming && (
            <button
              type="button"
              class="bubble-action"
              onClick={() => void copyText()}
            >
              Kopiuj
            </button>
          )}
          {message.error && onRetry && (
            <button type="button" class="bubble-action bubble-action--retry" onClick={onRetry}>
              Spróbuj ponownie
            </button>
          )}
        </div>
      </div>
      {isAssistant
        ? (
          <>
            <MarkdownBody content={message.content || (message.streaming ? " " : "")} />
            {message.streaming && <span class="stream-cursor" aria-hidden="true" />}
          </>
        )
        : <div class="bubble-body">{message.content}</div>}
      {message.attachments?.length && <MessageAttachments attachments={message.attachments} />}
      {message.toolResults?.length && (
        <details class="bubble-tools-details">
          <summary class="bubble-tools-summary">Narzędzia ({message.toolResults.length})</summary>
          <div class="bubble-tools">
            {message.toolResults.map((t, i) => (
              <span key={i} class={`tool-chip${t.ok ? " tool-chip--ok" : " tool-chip--err"}`}>
                {t.ok ? t.output ?? t.tool : `${t.tool}: ${t.error}`}
              </span>
            ))}
          </div>
        </details>
      )}
      {message.role === "assistant" && message.model && !message.streaming && (
        <div class="bubble-meta">
          {message.provider}/{message.model}
        </div>
      )}
    </article>
  );
}
