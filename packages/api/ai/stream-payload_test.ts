import { assertEquals } from "@std/assert";
import { extractGeminiDelta, extractOpenAiDelta } from "./stream-payload.ts";

Deno.test("extractOpenAiDelta reads content chunk", () => {
  const text = extractOpenAiDelta({ choices: [{ delta: { content: "Hello" } }] });
  assertEquals(text, "Hello");
});

Deno.test("extractGeminiDelta reads text chunk", () => {
  const text = extractGeminiDelta({
    candidates: [{ content: { parts: [{ text: "Hi" }] } }],
  });
  assertEquals(text, "Hi");
});
