import { assertEquals } from "@std/assert";
import { DEFAULT_GROUP_PREFS } from "@chatgpa/core";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import { parseActions } from "./actions.ts";
import { withChatContext } from "./providers.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";
import { createMemoryStore, executeActions } from "./tools.ts";

Deno.test("SYSTEM_PROMPT is FS-first (Cursor-style) with minimal tools", () => {
  assertEquals(SYSTEM_PROMPT.includes("fs.list"), true);
  assertEquals(SYSTEM_PROMPT.includes("fs.read"), true);
  assertEquals(SYSTEM_PROMPT.includes("fs.write"), true);
  assertEquals(SYSTEM_PROMPT.includes("fs.mkdir"), true);
  assertEquals(SYSTEM_PROMPT.includes("fs.delete"), true);
  assertEquals(SYSTEM_PROMPT.includes("calendar.freeSlots"), true);
  assertEquals(SYSTEM_PROMPT.includes("plan.generate"), true);
  assertEquals(SYSTEM_PROMPT.includes("web.search"), true);
  assertEquals(SYSTEM_PROMPT.includes("Nie masz na start ocen"), true);
  assertEquals(SYSTEM_PROMPT.includes("todo.list"), false);
  assertEquals(SYSTEM_PROMPT.includes("grades.get"), false);
  assertEquals(SYSTEM_PROMPT.includes("memory.remember"), false);
});

Deno.test("study plan workflow prefers plan.generate", () => {
  const mockAiResponse = `Układam plan na dziś.

\`\`\`chatgpa-action
{ "tool": "plan.generate", "args": {} }
\`\`\``;

  const actions = parseActions(mockAiResponse);
  assertEquals(actions.length, 1);
  assertEquals(actions[0]?.tool, "plan.generate");
});

Deno.test("withChatContext does not inject memory, todo, grades, or calendar data", () => {
  const messages = withChatContext(
    [{ role: "user", content: "Jaka mam średnia z chemii?" }],
    DEFAULT_GROUP_PREFS,
    { memoryHint: "Pamięć ucznia: 2 długich, 0 krótkich wpisów." },
  );
  const system = messages[0]?.content ?? "";

  assertEquals(system.includes("Klasa 3A"), false);
  assertEquals(system.includes("Powtórka matma"), false);
  assertEquals(system.includes("syncedAt"), false);
  // Prompt may document ~/calendar paths; real event data must not be injected.
  assertEquals(system.includes("[homework]"), false);
  assertEquals(system.includes("Plan lekcji ucznia"), true);
  assertEquals(system.includes("2 długich"), true);
});

Deno.test("grade question workflow calls grades.get instead of guessing", () => {
  const mockAiResponse = `Sprawdzę Twoje oceny z chemii.

\`\`\`chatgpa-action
{ "tool": "grades.get", "args": { "subject": "chemia" } }
\`\`\``;

  const actions = parseActions(mockAiResponse);
  assertEquals(actions.length, 1);
  assertEquals(actions[0]?.tool, "grades.get");
  assertEquals(actions[0]?.args?.subject, "chemia");
});

withTestDb("grade question without sync returns no Librus data", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const mockAiResponse = `\`\`\`chatgpa-action
{ "tool": "grades.get", "args": { "subject": "chemia" } }
\`\`\``;

    const actions = parseActions(mockAiResponse);
    const { results } = await executeActions(actions, store);

    assertEquals(results.length, 1);
    assertEquals(results[0].tool, "grades.get");
    assertEquals(results[0].ok, true);
    assertEquals(results[0].output?.includes("Brak synchronizacji Librus"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("grades.get returns subject average when snapshot exists", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    await executeActions(
      [{
        tool: "fs.write",
        args: {
          path: "~/school/librus/grades.json",
          content: JSON.stringify({
            syncedAt: new Date().toISOString(),
            subjects: [{
              name: "Chemia",
              average: 4.5,
              grades: [{ value: 5, category: "sprawdzian", date: "2026-09-01" }],
            }],
          }),
        },
      }],
      store,
    );

    const { results } = await executeActions(
      [{ tool: "grades.get", args: { subject: "chemia" } }],
      store,
    );
    assertEquals(results[0].ok, true);
    assertEquals(results[0].output?.includes("Chemia"), true);
    assertEquals(results[0].output?.includes("4.5"), true);
  } finally {
    setDbForTests(undefined);
  }
});
