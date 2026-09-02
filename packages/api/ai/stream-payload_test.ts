import { assertEquals } from "@std/assert";
import { extractGeminiDelta, extractOpenAiDelta, openAiConfig } from "./stream-payload.ts";

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

Deno.test("openAiConfig resolves zai and mistral", () => {
  assertEquals(openAiConfig("zai").url, "https://api.z.ai/api/paas/v4");
  assertEquals(openAiConfig("mistral").url, "https://api.mistral.ai/v1");
});
