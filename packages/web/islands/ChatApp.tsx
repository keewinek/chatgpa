import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
}

const API_BASE = "";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ChatApp() {
  const messages = useSignal<UiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Cześć — tu ChatGPA. Napisz cokolwiek, a odpiszę darmowym modelem AI (od najmądrzejszego do najgłupszego, aż coś zadziała). Pod odpowiedzią zobaczysz, który model odpowiedział.",
      provider: "system",
      model: "welcome",
    },
  ]);
  const input = useSignal("");
  const loading = useSignal(false);
  const status = useSignal("Sprawdzam modele…");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/ai/models`)
      .then((r) => r.json())
      .then((data: { models: Array<{ configured: boolean; label: string }> }) => {
        const ready = data.models.filter((m) => m.configured);
        if (ready.length === 0) {
          status.value =
            "Brak kluczy AI — dodaj GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY do .env i zrestartuj serwer.";
        } else {
          status.value = `${ready.length} slotów gotowych · kaskada: ${
            ready.map((m) => m.label).join(" → ")
          }`;
        }
      })
      .catch(() => {
        status.value = "API niedostępne — uruchom `deno task dev`.";
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  async function send() {
    const text = input.value.trim();
    if (!text || loading.value) return;

    const userMsg: UiMessage = { id: uid(), role: "user", content: text };
    messages.value = [...messages.value, userMsg];
    input.value = "";
    loading.value = true;

    const history = messages.value
      .filter((m) => !m.error && m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();

      if (!res.ok) {
        const detail = data.attempts?.length
          ? `\n\nPróby: ${
            data.attempts
              .map((a: { model: string; error?: string }) =>
                `${a.model}${a.error ? ` (${a.error})` : ""}`
              )
              .join(" → ")
          }`
          : "";
        messages.value = [
          ...messages.value,
          {
            id: uid(),
            role: "assistant",
            content: `${data.error ?? "Błąd AI"}${detail}`,
            error: true,
          },
        ];
      } else {
        messages.value = [
          ...messages.value,
          {
            id: uid(),
            role: "assistant",
            content: data.message.content,
            model: data.model,
            provider: data.provider,
          },
        ];
      }
    } catch (err) {
      messages.value = [
        ...messages.value,
        {
          id: uid(),
          role: "assistant",
          content: `Nie udało się połączyć z API: ${
            err instanceof Error ? err.message : String(err)
          }`,
          error: true,
        },
      ];
    } finally {
      loading.value = false;
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div class="chat">
      <header class="chat-header">
        <div class="chat-brand">
          <span class="chat-logo">ChatGPA</span>
          <span class="chat-tag">Cursor do szkoły · darmowe AI</span>
        </div>
        <p class="chat-status">{status.value}</p>
      </header>

      <div class="chat-messages" role="log" aria-live="polite">
        {messages.value.map((m) => (
          <article
            key={m.id}
            class={`bubble bubble--${m.role}${m.error ? " bubble--error" : ""}`}
          >
            <div class="bubble-role">
              {m.role === "user" ? "Ty" : "ChatGPA"}
            </div>
            <div class="bubble-body">{m.content}</div>
            {m.role === "assistant" && m.model && m.model !== "welcome" && (
              <div class="bubble-meta">
                model: <code>{m.provider}/{m.model}</code>
              </div>
            )}
          </article>
        ))}
        {loading.value && (
          <article class="bubble bubble--assistant bubble--pending">
            <div class="bubble-role">ChatGPA</div>
            <div class="bubble-body thinking">Myślę (kaskada darmowych modeli)…</div>
          </article>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        class="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          class="chat-input"
          rows={1}
          placeholder="Napisz wiadomość… (Enter wyślij, Shift+Enter nowa linia)"
          value={input.value}
          onInput={(e) => {
            input.value = (e.target as HTMLTextAreaElement).value;
          }}
          onKeyDown={onKeyDown}
          disabled={loading.value}
        />
        <button class="chat-send" type="submit" disabled={loading.value || !input.value.trim()}>
          Wyślij
        </button>
      </form>
    </div>
  );
}
