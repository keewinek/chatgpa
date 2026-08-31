import { resolveMessageParts } from "../files/attachments.ts";
import { MODEL_CASCADE } from "./cascade-config.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";
import { buildMemoryBlock } from "./tools.ts";
import type { ChatMessage, ModelSlot } from "./types.ts";

const OPENAI_BASE: Record<string, { url: string; headers?: Record<string, string> }> = {
  groq: { url: "https://api.groq.com/openai/v1" },
  openrouter: {
    url: "https://openrouter.ai/api/v1",
    headers: { "HTTP-Referer": "https://github.com/chatgpa", "X-Title": "ChatGPA" },
  },
};

function apiKey(env: string): string | undefined {
  const v = Deno.env.get(env)?.trim();
  return v || undefined;
}

export function availableSlots(forceModel?: string, visionOnly = false): ModelSlot[] {
  let slots = MODEL_CASCADE.filter((s) => apiKey(s.apiKeyEnv)).sort((a, b) =>
    b.priority - a.priority
  );
  if (visionOnly) slots = slots.filter((s) => s.provider === "gemini");
  if (forceModel) slots = slots.filter((s) => s.model === forceModel);
  return slots;
}

export function listPublicModels() {
  return MODEL_CASCADE.map((s) => ({
    provider: s.provider,
    model: s.model,
    label: s.label,
    priority: s.priority,
    configured: Boolean(apiKey(s.apiKeyEnv)),
  }));
}

async function callGemini(
  model: string,
  key: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
) {
  const system: string[] = [];
  const contents: Array<{ role: string; parts: unknown[] }> = [];

  for (const m of messages) {
    if (m.role === "system") {
      system.push(m.content);
      continue;
    }
    const { text, geminiInline } = await resolveMessageParts(m);
    const parts: unknown[] = [];
    if (text) parts.push({ text });
    for (const inline of geminiInline) parts.push({ inlineData: inline });
    if (!parts.length) parts.push({ text: "(pusta wiadomość)" });
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system.length ? { parts: [{ text: system.join("\n\n") }] } : undefined,
        contents,
        generationConfig: { temperature: 0.7 },
      }),
      signal,
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `gemini ${res.status}: ${
        (body as { error?: { message?: string } }).error?.message ?? res.statusText
      }`,
    );
  }
  const text = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("gemini: empty response");
  return text;
}

async function callOpenAiCompat(
  provider: string,
  model: string,
  key: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
) {
  const cfg = OPENAI_BASE[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);

  const apiMessages: Array<{ role: string; content: string | unknown[] }> = [];
  for (const m of messages) {
    if (m.role === "system") {
      apiMessages.push({ role: "system", content: m.content });
      continue;
    }
    const { text, imageDataUrls } = await resolveMessageParts(m);
    if (!imageDataUrls.length) {
      apiMessages.push({ role: m.role, content: text || "(pusta wiadomość)" });
      continue;
    }
    const parts: unknown[] = [];
    if (text) parts.push({ type: "text", text });
    for (const url of imageDataUrls) parts.push({ type: "image_url", image_url: { url } });
    apiMessages.push({ role: m.role, content: parts });
  }

  const res = await fetch(`${cfg.url}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...cfg.headers },
    body: JSON.stringify({ model, messages: apiMessages, temperature: 0.7 }),
    signal,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `${provider} ${res.status}: ${
        (body as { error?: { message?: string } }).error?.message ?? res.statusText
      }`,
    );
  }
  const content = (body as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]
    ?.message?.content;
  if (!content) throw new Error(`${provider}: empty response`);
  return content;
}

export async function invokeSlot(slot: ModelSlot, messages: ChatMessage[], timeoutMs = 45_000) {
  const key = apiKey(slot.apiKeyEnv);
  if (!key) throw new Error(`Missing ${slot.apiKeyEnv}`);
  const signal = AbortSignal.timeout(timeoutMs);
  if (slot.provider === "gemini") return await callGemini(slot.model, key, messages, signal);
  return await callOpenAiCompat(slot.provider, slot.model, key, messages, signal);
}

export function withSystemPrompt(messages: ChatMessage[]): ChatMessage[] {
  if (messages.some((m) => m.role === "system")) return messages;
  return [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
}

export function withMemoryContext(messages: ChatMessage[], memory: string[]): ChatMessage[] {
  const block = buildMemoryBlock(memory);
  const system = block ? `${SYSTEM_PROMPT}\n\n${block}` : SYSTEM_PROMPT;
  return [{ role: "system", content: system }, ...messages.filter((m) => m.role !== "system")];
}
