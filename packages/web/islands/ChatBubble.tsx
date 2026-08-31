import MarkdownBody from "./MarkdownBody.tsx";
import MessageAttachments from "./MessageAttachments.tsx";
import type { StoredMessage } from "../lib/chat-storage.ts";

export default function ChatBubble({ message }: { message: StoredMessage }) {
  const role = message.role === "user" ? "Ty" : "ChatGPA";
  const isAssistant = message.role === "assistant" && !message.error;

  return (
    <article class={`bubble bubble--${message.role}${message.error ? " bubble--error" : ""}`}>
      <div class="bubble-role">{role}</div>
      {isAssistant
        ? <MarkdownBody content={message.content} />
        : <div class="bubble-body">{message.content}</div>}
      {message.attachments?.length && <MessageAttachments attachments={message.attachments} />}
      {message.toolResults?.length && (
        <div class="bubble-tools">
          {message.toolResults.map((t, i) => (
            <span key={i} class={`tool-chip${t.ok ? " tool-chip--ok" : " tool-chip--err"}`}>
              {t.ok ? t.output ?? t.tool : `${t.tool}: ${t.error}`}
            </span>
          ))}
        </div>
      )}
      {message.role === "assistant" && message.model && (
        <div class="bubble-meta">
          model: <code>{message.provider}/{message.model}</code>
        </div>
      )}
    </article>
  );
}
