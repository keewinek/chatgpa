import { assertEquals } from "@std/assert";
import { availableSlots, listPublicModels, MODEL_CASCADE } from "./providers.ts";

Deno.test("MODEL_CASCADE is ordered smart → dumb by priority", () => {
  for (let i = 1; i < MODEL_CASCADE.length; i++) {
    assertEquals(
      MODEL_CASCADE[i - 1].priority > MODEL_CASCADE[i].priority,
      true,
    );
  }
});

Deno.test("listPublicModels mirrors cascade length", () => {
  assertEquals(listPublicModels().length, MODEL_CASCADE.length);
});

Deno.test("availableSlots empty without keys", () => {
  const keys = ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"] as const;
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
