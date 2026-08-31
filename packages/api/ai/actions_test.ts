import { assertEquals } from "@std/assert";
import { parseActions, stripActions } from "./actions.ts";

Deno.test("parseActions reads single tool block", () => {
  const content = `Plan na dziś:

\`\`\`chatgpa-action
{ "tool": "memory.remember", "args": { "text": "Lubię matematykę" } }
\`\`\`

Gotowe.`;
  const actions = parseActions(content);
  assertEquals(actions.length, 1);
  assertEquals(actions[0].tool, "memory.remember");
  assertEquals(actions[0].args?.text, "Lubię matematykę");
});

Deno.test("stripActions removes tool blocks", () => {
  const content = `Tekst\n\`\`\`chatgpa-action\n{"tool":"datetime.now"}\n\`\`\`\nKoniec`;
  assertEquals(stripActions(content), "Tekst\n\nKoniec");
});
