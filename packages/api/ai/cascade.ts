import { availableSlots, cascadeNeedsVision, invokeSlot, withSystemPrompt } from "./providers.ts";
import type { AiAttempt, AiResult, ChatMessage } from "./types.ts";

const ATTEMPT_TIMEOUT_MS = 45_000;

/**
 * Try free models from smartest → dumbest until one succeeds.
 */
export async function runCascade(
  messages: ChatMessage[],
  forceModel?: string,
  options?: { skipSystemWrap?: boolean },
): Promise<AiResult> {
  const prepared = options?.skipSystemWrap ? messages : withSystemPrompt(messages);
  const visionOnly = cascadeNeedsVision(prepared);
  const slots = availableSlots(forceModel, visionOnly);
  const attempts: AiAttempt[] = [];

  if (slots.length === 0) {
    return {
      ok: false,
      error: visionOnly
        ? "Pliki wymagają GEMINI_API_KEY (obrazy i PDF). Ustaw klucz w .env."
        : "Brak skonfigurowanych darmowych kluczy AI. Ustaw GEMINI_API_KEY, GROQ_API_KEY lub OPENROUTER_API_KEY w .env (patrz .env.example).",
      attempts,
    };
  }

  for (const slot of slots) {
    const started = performance.now();
    try {
      const content = await invokeSlot(slot, prepared, ATTEMPT_TIMEOUT_MS);
      attempts.push({
        provider: slot.provider,
        model: slot.model,
        ok: true,
        latencyMs: Math.round(performance.now() - started),
      });
      return {
        ok: true,
        content,
        provider: slot.provider,
        model: slot.model,
        attempts,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({
        provider: slot.provider,
        model: slot.model,
        ok: false,
        error: message,
        latencyMs: Math.round(performance.now() - started),
      });
      console.warn(
        `[ai-cascade] ${slot.provider}/${slot.model} failed: ${message}`,
      );
    }
  }

  return {
    ok: false,
    error: "Wszystkie darmowe modele zawiodły. Sprawdź klucze i limity.",
    attempts,
  };
}
