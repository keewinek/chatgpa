import { resolveMessageParts } from "../files/attachments.ts";
import type { ChatMessage } from "./types.ts";

const OPENAI_BASE: Record<string, { url: string; headers?: Record<string, string> }> = {
  groq: { url: "https://api.groq.com/openai/v1" },
  openrouter: {
    url: "https://openrouter.ai/api/v1",
    headers: { "HTTP-Referer": "https://github.com/chatgpa", "X-Title": "ChatGPA" },
  },
};

export interface GeminiPayload {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: unknown[] }>;
}

export async function buildGeminiPayload(messages: ChatMessage[]): Promise<GeminiPayload> {
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

  return {
    systemInstruction: system.length ? { parts: [{ text: system.join("\n\n") }] } : undefined,
    contents,
  };
}

export async function buildOpenAiMessages(messages: ChatMessage[]) {
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
  return apiMessages;
}

export function openAiConfig(provider: string) {
  const cfg = OPENAI_BASE[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);
  return cfg;
}

/** Parse SSE lines from Gemini or OpenAI streaming APIs. */
export async function* readSseText(
  body: ReadableStream<Uint8Array>,
  extract: (json: unknown) => string | undefined,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
      if (!payload || payload === "[DONE]") continue;
      try {
        const text = extract(JSON.parse(payload));
        if (text) yield text;
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export function extractGeminiDelta(json: unknown): string | undefined {
  const parts = (json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }).candidates?.[0]?.content?.parts;
  if (!parts?.length) return undefined;
  return parts.map((p) => p.text ?? "").join("");
}

export function extractOpenAiDelta(json: unknown): string | undefined {
  const delta = (json as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta
    ?.content;
  return delta ?? undefined;
}
