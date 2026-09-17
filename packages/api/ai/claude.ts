import { resolveMessageParts } from "../files/attachments.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";
import {
  DEFAULT_GROUP_PREFS,
  formatTimetableForAi,
  formatWarsawDateTimeForAi,
  type GroupPrefs,
} from "@chatgpa/core";
import type { AiAttempt, AiResult, ChatMessage } from "./types.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT_MS = 45_000;
const MAX_TOKENS = 4096;

/** Main chat model — quality over cost, single user. */
export const CLAUDE_MODEL = "claude-sonnet-5";
/** Cheap model for background passes (memory-fact extraction). */
export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

const NO_KEY = "Brak ANTHROPIC_API_KEY w .env.";

function apiKey(): string | undefined {
  return Deno.env.get("ANTHROPIC_API_KEY")?.trim() || undefined;
}

export function isClaudeConfigured(): boolean {
  return Boolean(apiKey());
}

export function listPublicModels() {
  return [
    {
      provider: "anthropic",
      model: CLAUDE_MODEL,
      label: "Claude Sonnet 5",
      priority: 100,
      configured: isClaudeConfigured(),
    },
  ];
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

function dataUrlToBlock(url: string): Record<string, unknown> | undefined {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match) return undefined;
  return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
}

async function buildAnthropicMessages(
  messages: ChatMessage[],
): Promise<{ system: string; apiMessages: AnthropicMessage[] }> {
  const systemParts: string[] = [];
  const apiMessages: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
      continue;
    }
    const { text, imageDataUrls } = await resolveMessageParts(m);
    if (!imageDataUrls.length) {
      apiMessages.push({ role: m.role, content: text || "(pusta wiadomość)" });
      continue;
    }
    const parts: Array<Record<string, unknown>> = [];
    if (text) parts.push({ type: "text", text });
    for (const url of imageDataUrls) {
      const block = dataUrlToBlock(url);
      if (block) parts.push(block);
    }
    apiMessages.push({ role: m.role, content: parts });
  }

  return { system: systemParts.join("\n\n"), apiMessages };
}

interface AnthropicErrorBody {
  error?: { message?: string };
}

async function callClaude(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error(NO_KEY);
  const { system, apiMessages } = await buildAnthropicMessages(messages);
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: system || undefined,
      messages: apiMessages,
      temperature: 0.7,
    }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `claude ${res.status}: ${(body as AnthropicErrorBody).error?.message ?? res.statusText}`,
    );
  }
  const content = (body as { content?: Array<{ type: string; text?: string }> }).content
    ?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  if (!content) throw new Error("claude: empty response");
  return content;
}

async function* streamClaude(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const key = apiKey();
  if (!key) throw new Error(NO_KEY);
  const { system, apiMessages } = await buildAnthropicMessages(messages);
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: system || undefined,
      messages: apiMessages,
      temperature: 0.7,
      stream: true,
    }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `claude ${res.status}: ${(body as AnthropicErrorBody).error?.message ?? res.statusText}`,
    );
  }
  if (!res.body) throw new Error("claude: empty stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawText = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd: number;
    while ((lineEnd = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const json = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
          error?: { message?: string };
        };
        if (json.type === "error") {
          throw new Error(`claude stream: ${json.error?.message ?? "unknown error"}`);
        }
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          const text = json.delta.text;
          if (text) {
            sawText = true;
            yield text;
          }
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue; // malformed chunk, skip
        throw err;
      }
    }
  }

  if (!sawText) throw new Error("claude: empty response");
}

function pickSlots(forceModel?: string) {
  if (!isClaudeConfigured()) return [];
  return [{ provider: "anthropic", model: forceModel ?? CLAUDE_MODEL }];
}

export async function runCascade(
  messages: ChatMessage[],
  forceModel?: string,
  options?: { skipSystemWrap?: boolean },
): Promise<AiResult> {
  const prepared = options?.skipSystemWrap ? messages : withSystemPrompt(messages);
  const slots = pickSlots(forceModel);
  if (!slots.length) return { ok: false, error: NO_KEY, attempts: [] };

  const slot = slots[0];
  const start = performance.now();
  try {
    const content = await callClaude(slot.model, prepared, AbortSignal.timeout(TIMEOUT_MS));
    const attempt: AiAttempt = {
      provider: slot.provider,
      model: slot.model,
      ok: true,
      latencyMs: Math.round(performance.now() - start),
    };
    return { ok: true, content, provider: slot.provider, model: slot.model, attempts: [attempt] };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const attempt: AiAttempt = {
      provider: slot.provider,
      model: slot.model,
      ok: false,
      error,
      latencyMs: Math.round(performance.now() - start),
    };
    return { ok: false, error, attempts: [attempt] };
  }
}

export interface StreamCascadeResult {
  ok: true;
  content: string;
  provider: string;
  model: string;
  attempts: AiAttempt[];
}

export interface StreamCascadeFailure {
  ok: false;
  error: string;
  attempts: AiAttempt[];
}

export type StreamCascadeOutcome = StreamCascadeResult | StreamCascadeFailure;

export async function* runCascadeStream(
  messages: ChatMessage[],
  forceModel?: string,
  options?: { skipSystemWrap?: boolean },
): AsyncGenerator<string, StreamCascadeOutcome, void> {
  const prepared = options?.skipSystemWrap ? messages : withSystemPrompt(messages);
  const slots = pickSlots(forceModel);
  if (!slots.length) return { ok: false, error: NO_KEY, attempts: [] };

  const slot = slots[0];
  const start = performance.now();
  let content = "";
  try {
    for await (const chunk of streamClaude(slot.model, prepared, AbortSignal.timeout(TIMEOUT_MS))) {
      content += chunk;
      yield chunk;
    }
    const attempt: AiAttempt = {
      provider: slot.provider,
      model: slot.model,
      ok: true,
      latencyMs: Math.round(performance.now() - start),
    };
    return { ok: true, content, provider: slot.provider, model: slot.model, attempts: [attempt] };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const attempt: AiAttempt = {
      provider: slot.provider,
      model: slot.model,
      ok: false,
      error,
      latencyMs: Math.round(performance.now() - start),
    };
    return { ok: false, error, attempts: [attempt] };
  }
}

export function withSystemPrompt(messages: ChatMessage[]): ChatMessage[] {
  if (messages.some((m) => m.role === "system")) return messages;
  return [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
}

export function withChatContext(
  messages: ChatMessage[],
  groupPrefs: GroupPrefs = DEFAULT_GROUP_PREFS,
  options: { memoryHint?: string } = {},
): ChatMessage[] {
  const datetimeBlock = formatWarsawDateTimeForAi();
  const timetableBlock =
    `Plan lekcji ucznia (zawsze aktualny — używaj przy planowaniu dnia i odpowiedziach o szkole):\n${
      formatTimetableForAi(groupPrefs)
    }`;
  const parts = [SYSTEM_PROMPT, datetimeBlock, timetableBlock, options.memoryHint].filter(
    Boolean,
  );
  const system = parts.join("\n\n");
  return [{ role: "system", content: system }, ...messages.filter((m) => m.role !== "system")];
}
