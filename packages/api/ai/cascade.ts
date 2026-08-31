import { messagesNeedVision } from "../files/store.ts";
import { availableSlots, invokeSlot, withSystemPrompt } from "./providers.ts";
import type { AiAttempt, AiResult, ChatMessage } from "./types.ts";

const TIMEOUT_MS = 45_000;
const NO_KEYS = "Brak kluczy AI. Ustaw GEMINI_API_KEY, GROQ_API_KEY lub OPENROUTER_API_KEY w .env.";
const NO_VISION_KEYS = "Pliki wymagają GEMINI_API_KEY (obrazy i PDF).";

export async function runCascade(
  messages: ChatMessage[],
  forceModel?: string,
  options?: { skipSystemWrap?: boolean },
): Promise<AiResult> {
  const prepared = options?.skipSystemWrap ? messages : withSystemPrompt(messages);
  const visionOnly = messagesNeedVision(prepared);
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
