import { buildMemoryBlock } from "./tools.ts";
import {
  attachmentTextSnippet,
  bytesToBase64,
  describeAttachment,
  getFile,
  messagesNeedVision,
} from "../files/store.ts";
import { isVisionMime } from "../files/mime.ts";
import type { ChatMessage, ModelSlot } from "./types.ts";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenAiMessage = {
  role: string;
  content: string | OpenAiContentPart[];
};

/**
 * Cascade order: smartest free models first, dumbest last.
 * Missing API keys are skipped automatically.
 */
export const MODEL_CASCADE: ModelSlot[] = [
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 100,
    label: "Gemini 2.5 Flash",
  },
  {
    provider: "gemini",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 90,
    label: "Gemini 2.0 Flash",
  },
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 80,
    label: "Llama 3.3 70B (Groq)",
  },
  {
    provider: "openrouter",
    model: "deepseek/deepseek-r1:free",
    apiKeyEnv: "OPENROUTER_API_KEY",
    priority: 70,
    label: "DeepSeek R1 (OpenRouter free)",
  },
  {
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    apiKeyEnv: "OPENROUTER_API_KEY",
    priority: 60,
    label: "Llama 3.3 70B (OpenRouter free)",
  },
  {
    provider: "groq",
    model: "llama-3.1-8b-instant",
    apiKeyEnv: "GROQ_API_KEY",
    priority: 40,
    label: "Llama 3.1 8B (Groq)",
  },
  {
    provider: "gemini",
    model: "gemini-2.0-flash-lite",
    apiKeyEnv: "GEMINI_API_KEY",
    priority: 30,
    label: "Gemini 2.0 Flash-Lite",
  },
];

export const DEFAULT_SYSTEM_PROMPT =
  `Jesteś ChatGPA — osobisty asystent edukacyjny ucznia (jak Cursor, ale do szkoły).
Odpowiadasz po polsku, konkretnie i przyjaźnie. Pomagasz planować naukę, tłumaczyć
materiały i ogarniać dzień szkolny. Nie wymyślaj ocen ani terminów, których nie znasz —
jeśli brakuje kontekstu, powiedz wprost i zaproponuj, co ustalić.

Formatowanie: używaj Markdown (nagłówki, listy, **pogrubienia**, bloki kodu).
Gdy uczeń poda ważny fakt o sobie (przedmioty, terminy, preferencje), zapisz go narzędziem.

Narzędzia — gdy potrzebujesz wykonać akcję, dodaj blok (bez komentarza przed nim):

\`\`\`chatgpa-action
{ "tool": "memory.remember", "args": { "text": "fakt do zapamiętania" } }
\`\`\`

Dostępne narzędzia:
- memory.remember — zapisz fakt o uczniu (args.text)
- memory.list — pokaż zapisaną pamięć
- memory.forget — usuń fakt (args.text)
- datetime.now — aktualna data i czas (Warszawa)
- calc.eval — oblicz wyrażenie (args.expression, np. "(2+3)*4")
- file.send — wyślij plik do ucznia (args.name, args.content, opcjonalnie args.mimeType jak text/plain lub text/markdown)

Możesz zwrócić kilka bloków chatgpa-action w jednej odpowiedzi. Po narzędziu kontynuujesz rozmowę normalnie.`;

const OPENAI_COMPAT: Record<
  string,
  { baseUrl: string; extraHeaders?: (key: string) => Record<string, string> }
> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    extraHeaders: () => ({
      "HTTP-Referer": "https://github.com/chatgpa",
      "X-Title": "ChatGPA",
    }),
  },
};

function getApiKey(envName: string): string | undefined {
  const value = Deno.env.get(envName)?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Active slots sorted by priority desc (smart → dumb). */
export function availableSlots(forceModel?: string, visionOnly = false): ModelSlot[] {
  let slots = MODEL_CASCADE
    .filter((s) => getApiKey(s.apiKeyEnv))
    .sort((a, b) => b.priority - a.priority);

  if (visionOnly) {
    slots = slots.filter((s) => s.provider === "gemini");
  }

  if (forceModel) {
    return slots.filter((s) => s.model === forceModel);
  }
  return slots;
}

export function listPublicModels() {
  return MODEL_CASCADE.map((s) => ({
    provider: s.provider,
    model: s.model,
    label: s.label,
    priority: s.priority,
    configured: Boolean(getApiKey(s.apiKeyEnv)),
  }));
}

async function buildGeminiParts(message: ChatMessage): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = [];
  const textChunks: string[] = [];

  if (message.content.trim()) textChunks.push(message.content.trim());

  for (const att of message.attachments ?? []) {
    const file = getFile(att.id);
    if (!file) continue;

    if (isVisionMime(file.mimeType)) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: bytesToBase64(file.bytes),
        },
      });
      continue;
    }

    const snippet = await attachmentTextSnippet(file);
    if (snippet) {
      textChunks.push(`Treść pliku „${file.name}”:\n${snippet}`);
    } else {
      textChunks.push(describeAttachment(file));
    }
  }

  if (textChunks.length > 0) {
    parts.unshift({ text: textChunks.join("\n\n") });
  }

  return parts.length > 0 ? parts : [{ text: "(pusta wiadomość)" }];
}

async function buildOpenAiParts(message: ChatMessage): Promise<OpenAiContentPart[]> {
  const parts: OpenAiContentPart[] = [];
  const textChunks: string[] = [];

  if (message.content.trim()) textChunks.push(message.content.trim());

  for (const att of message.attachments ?? []) {
    const file = getFile(att.id);
    if (!file) continue;

    if (file.mimeType.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${file.mimeType};base64,${bytesToBase64(file.bytes)}`,
        },
      });
      continue;
    }

    const snippet = await attachmentTextSnippet(file);
    if (snippet) {
      textChunks.push(`Treść pliku „${file.name}”:\n${snippet}`);
    } else {
      textChunks.push(describeAttachment(file));
    }
  }

  if (textChunks.length > 0) {
    parts.unshift({ type: "text", text: textChunks.join("\n\n") });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: "(pusta wiadomość)" }];
}

async function callOpenAiCompat(
  provider: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const cfg = OPENAI_COMPAT[provider];
  if (!cfg) throw new Error(`Unknown OpenAI-compat provider: ${provider}`);

  const openAiMessages: OpenAiMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      openAiMessages.push({ role: "system", content: m.content });
      continue;
    }
    const parts = await buildOpenAiParts(m);
    const hasOnlyText = parts.length === 1 && parts[0].type === "text";
    openAiMessages.push({
      role: m.role,
      content: hasOnlyText ? (parts[0] as { type: "text"; text: string }).text : parts,
    });
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(cfg.extraHeaders?.(apiKey) ?? {}),
    },
    body: JSON.stringify({
      model,
      messages: openAiMessages,
      temperature: 0.7,
    }),
    signal,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ??
      res.statusText;
    throw new Error(`${provider} ${res.status}: ${msg}`);
  }

  const content = (body as {
    choices?: Array<{ message?: { content?: string } }>;
  })?.choices?.[0]?.message?.content;

  if (!content) throw new Error(`${provider}: empty response`);
  return content;
}

async function callGemini(
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const systemParts: string[] = [];
  const contents: Array<{ role: string; parts: GeminiPart[] }> = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: await buildGeminiParts(m),
    });
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: systemParts.length
        ? { parts: [{ text: systemParts.join("\n\n") }] }
        : undefined,
      contents,
      generationConfig: { temperature: 0.7 },
    }),
    signal,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ??
      res.statusText;
    throw new Error(`gemini ${res.status}: ${msg}`);
  }

  const text = (body as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  })?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");

  if (!text) throw new Error("gemini: empty response");
  return text;
}

export async function invokeSlot(
  slot: ModelSlot,
  messages: ChatMessage[],
  timeoutMs = 45_000,
): Promise<string> {
  const apiKey = getApiKey(slot.apiKeyEnv);
  if (!apiKey) throw new Error(`Missing ${slot.apiKeyEnv}`);

  const signal = AbortSignal.timeout(timeoutMs);

  if (slot.provider === "gemini") {
    return await callGemini(slot.model, apiKey, messages, signal);
  }
  return await callOpenAiCompat(slot.provider, slot.model, apiKey, messages, signal);
}

export function cascadeNeedsVision(messages: ChatMessage[]): boolean {
  return messagesNeedVision(messages);
}

export function withSystemPrompt(messages: ChatMessage[]): ChatMessage[] {
  const hasSystem = messages.some((m) => m.role === "system");
  if (hasSystem) return messages;
  return [{ role: "system", content: DEFAULT_SYSTEM_PROMPT }, ...messages];
}

/** System prompt + optional student memory block for tool-aware chat. */
export function withMemoryContext(messages: ChatMessage[], memory: string[]): ChatMessage[] {
  const memoryBlock = buildMemoryBlock(memory);
  const systemContent = memoryBlock
    ? `${DEFAULT_SYSTEM_PROMPT}\n\n${memoryBlock}`
    : DEFAULT_SYSTEM_PROMPT;

  const withoutSystem = messages.filter((m) => m.role !== "system");
  return [{ role: "system", content: systemContent }, ...withoutSystem];
}
