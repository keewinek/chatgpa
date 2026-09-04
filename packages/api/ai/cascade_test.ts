import { assertEquals } from "@std/assert";
import { MODEL_CASCADE } from "./cascade-config.ts";
import { availableSlots, listPublicModels } from "./providers.ts";
import {
  clearSlotCooldowns,
  isSlotCoolingDown,
  markSlotFailure,
} from "./slot-cooldown.ts";

Deno.test("MODEL_CASCADE is ordered by priority descending", () => {
  for (let i = 1; i < MODEL_CASCADE.length; i++) {
    assertEquals(
      MODEL_CASCADE[i - 1].priority > MODEL_CASCADE[i].priority,
      true,
    );
  }
});

Deno.test("MODEL_CASCADE prefers smarter Gemini before weaker fallbacks", () => {
  assertEquals(MODEL_CASCADE[0].provider, "gemini");
  assertEquals(MODEL_CASCADE[0].model, "gemini-3.5-flash");
  const groq120 = MODEL_CASCADE.findIndex((s) => s.model === "openai/gpt-oss-120b");
  const groq20 = MODEL_CASCADE.findIndex((s) => s.model === "openai/gpt-oss-20b");
  assertEquals(groq120 > 0, true);
  assertEquals(groq20 > groq120, true);
  assertEquals(MODEL_CASCADE.some((s) => s.model.includes("flash-lite")), false);
});

Deno.test("listPublicModels mirrors cascade length", () => {
  assertEquals(listPublicModels().length, MODEL_CASCADE.length);
});

Deno.test("availableSlots empty without keys", () => {
  const keys = [
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "ZAI_API_KEY",
    "MISTRAL_API_KEY",
  ] as const;
  const backup = Object.fromEntries(keys.map((k) => [k, Deno.env.get(k)]));
  for (const k of keys) Deno.env.delete(k);
  try {
    assertEquals(availableSlots().length, 0);
  } finally {
    for (const k of keys) {
      const v = backup[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
});

Deno.test("slot cooldown skips quota and gone models", () => {
  clearSlotCooldowns();
  const now = Date.now();
  markSlotFailure("gemini", "gemini-2.5-flash", "gemini 429: quota exceeded", now);
  markSlotFailure(
    "gemini",
    "gemini-2.5-flash-lite",
    "gemini 404: no longer available",
    now,
  );
  assertEquals(isSlotCoolingDown("gemini", "gemini-2.5-flash", now + 1000), true);
  assertEquals(isSlotCoolingDown("gemini", "gemini-2.5-flash-lite", now + 1000), true);
  assertEquals(isSlotCoolingDown("groq", "openai/gpt-oss-20b", now + 1000), false);
  clearSlotCooldowns();
});
