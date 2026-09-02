import { messagesNeedVision } from "../files/store.ts";
import { availableSlots, invokeSlot, streamSlot, withSystemPrompt } from "./providers.ts";
import type { AiAttempt, AiResult, ChatMessage } from "./types.ts";

const TIMEOUT_MS = 45_000;
const NO_KEYS =
  "Brak kluczy AI. Ustaw co najmniej jeden: GEMINI_API_KEY, GROQ_API_KEY, ZAI_API_KEY, MISTRAL_API_KEY lub OPENROUTER_API_KEY w .env.";
const NO_VISION_KEYS = "Pliki wymagają GEMINI_API_KEY (obrazy i PDF).";

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

export async function runCascade(
  messages: ChatMessage[],
  forceModel?: string,
  options?: { skipSystemWrap?: boolean },
): Promise<AiResult> {
  const prepared = options?.skipSystemWrap ? messages : withSystemPrompt(messages);
  const visionOnly = await messagesNeedVision(prepared);
  const slots = availableSlots(forceModel, visionOnly);
  const attempts: AiAttempt[] = [];

  if (!slots.length) {
    return { ok: false, error: visionOnly ? NO_VISION_KEYS : NO_KEYS, attempts };
  }

  for (const slot of slots) {
    const start = performance.now();
    try {
      const content = await invokeSlot(slot, prepared, TIMEOUT_MS);
      attempts.push({
        provider: slot.provider,
        model: slot.model,
        ok: true,
        latencyMs: Math.round(performance.now() - start),
      });
      return { ok: true, content, provider: slot.provider, model: slot.model, attempts };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      attempts.push({
        provider: slot.provider,
        model: slot.model,
        ok: false,
        error,
        latencyMs: Math.round(performance.now() - start),
      });
      console.warn(`[cascade] ${slot.provider}/${slot.model}: ${error}`);
    }
  }

  return { ok: false, error: "Wszystkie modele zawiodły. Sprawdź klucze i limity.", attempts };
}

/** Stream text deltas; yields chunks then returns final outcome via generator return. */
export async function* runCascadeStream(
  messages: ChatMessage[],
  forceModel?: string,
  options?: { skipSystemWrap?: boolean },
): AsyncGenerator<string, StreamCascadeOutcome, void> {
  const prepared = options?.skipSystemWrap ? messages : withSystemPrompt(messages);
  const visionOnly = await messagesNeedVision(prepared);
  const slots = availableSlots(forceModel, visionOnly);
  const attempts: AiAttempt[] = [];

  if (!slots.length) {
    return { ok: false, error: visionOnly ? NO_VISION_KEYS : NO_KEYS, attempts };
  }

  for (const slot of slots) {
    const start = performance.now();
    let content = "";
    try {
      for await (const chunk of streamSlot(slot, prepared, TIMEOUT_MS)) {
        content += chunk;
        yield chunk;
      }
      if (!content) throw new Error(`${slot.provider}: empty response`);
      attempts.push({
        provider: slot.provider,
        model: slot.model,
        ok: true,
        latencyMs: Math.round(performance.now() - start),
      });
      return { ok: true, content, provider: slot.provider, model: slot.model, attempts };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      attempts.push({
        provider: slot.provider,
        model: slot.model,
        ok: false,
        error,
        latencyMs: Math.round(performance.now() - start),
      });
      console.warn(`[cascade] ${slot.provider}/${slot.model}: ${error}`);
    }
  }

  return { ok: false, error: "Wszystkie modele zawiodły. Sprawdź klucze i limity.", attempts };
}
