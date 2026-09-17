import { assertEquals } from "@std/assert";
import { CLAUDE_MODEL, isClaudeConfigured, listPublicModels } from "./claude.ts";

function withEnv(key: string, value: string | undefined, fn: () => void) {
  const backup = Deno.env.get(key);
  if (value === undefined) Deno.env.delete(key);
  else Deno.env.set(key, value);
  try {
    fn();
  } finally {
    if (backup === undefined) Deno.env.delete(key);
    else Deno.env.set(key, backup);
  }
}

Deno.test("isClaudeConfigured reflects ANTHROPIC_API_KEY", () => {
  withEnv("ANTHROPIC_API_KEY", undefined, () => {
    assertEquals(isClaudeConfigured(), false);
  });
  withEnv("ANTHROPIC_API_KEY", "sk-test-123", () => {
    assertEquals(isClaudeConfigured(), true);
  });
});

Deno.test("listPublicModels reports the single Claude model", () => {
  const models = listPublicModels();
  assertEquals(models.length, 1);
  assertEquals(models[0].provider, "anthropic");
  assertEquals(models[0].model, CLAUDE_MODEL);
});
