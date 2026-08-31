import {
  buildGeminiPayload,
  buildOpenAiMessages,
  extractGeminiDelta,
  extractOpenAiDelta,
  openAiConfig,
  readSseText,
} from "./stream-payload.ts";
import { MODEL_CASCADE } from "./cascade-config.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";
import { buildMemoryBlock } from "./tools.ts";
import type { ChatMessage, ModelSlot } from "./types.ts";

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
  const payload = await buildGeminiPayload(messages);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, generationConfig: { temperature: 0.7 } }),
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
  const cfg = openAiConfig(provider);
  const apiMessages = await buildOpenAiMessages(messages);
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

async function* streamGemini(
  model: string,
  key: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const payload = await buildGeminiPayload(messages);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, generationConfig: { temperature: 0.7 } }),
      signal,
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `gemini ${res.status}: ${
        (body as { error?: { message?: string } }).error?.message ?? res.statusText
      }`,
    );
  }
  if (!res.body) throw new Error("gemini: empty stream");
  for await (const chunk of readSseText(res.body, extractGeminiDelta)) yield chunk;
}

async function* streamOpenAiCompat(
  provider: string,
  model: string,
  key: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const cfg = openAiConfig(provider);
  const apiMessages = await buildOpenAiMessages(messages);
  const res = await fetch(`${cfg.url}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...cfg.headers },
    body: JSON.stringify({ model, messages: apiMessages, temperature: 0.7, stream: true }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `${provider} ${res.status}: ${
        (body as { error?: { message?: string } }).error?.message ?? res.statusText
      }`,
    );
  }
  if (!res.body) throw new Error(`${provider}: empty stream`);
  for await (const chunk of readSseText(res.body, extractOpenAiDelta)) yield chunk;
}

export async function invokeSlot(slot: ModelSlot, messages: ChatMessage[], timeoutMs = 45_000) {
  const key = apiKey(slot.apiKeyEnv);
  if (!key) throw new Error(`Missing ${slot.apiKeyEnv}`);
  const signal = AbortSignal.timeout(timeoutMs);
  if (slot.provider === "gemini") return await callGemini(slot.model, key, messages, signal);
  return await callOpenAiCompat(slot.provider, slot.model, key, messages, signal);
}

export async function* streamSlot(
  slot: ModelSlot,
  messages: ChatMessage[],
  timeoutMs = 45_000,
): AsyncGenerator<string> {
  const key = apiKey(slot.apiKeyEnv);
  if (!key) throw new Error(`Missing ${slot.apiKeyEnv}`);
  const signal = AbortSignal.timeout(timeoutMs);
  const gen = slot.provider === "gemini"
    ? streamGemini(slot.model, key, messages, signal)
    : streamOpenAiCompat(slot.provider, slot.model, key, messages, signal);
  for await (const chunk of gen) yield chunk;
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
