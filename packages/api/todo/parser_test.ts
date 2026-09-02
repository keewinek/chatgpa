import { assertEquals } from "@std/assert";
import { parseTodoFile, serializeTodoFile } from "./parser.ts";

Deno.test("parseTodoFile reads checkbox lines with metadata", () => {
  const content = `---
updatedAt: 2026-09-02T18:00:00+02:00
---

# Globalna TODO

- [ ] Powtórka: kwasy — chemia — due: 2026-09-05 — 25min — priority: high
- [x] Zadanie z historii — id: task-done-1 — done: 2026-09-01
`;

  const { updatedAt, tasks } = parseTodoFile(content);
  assertEquals(updatedAt, "2026-09-02T18:00:00+02:00");
  assertEquals(tasks.length, 2);

  assertEquals(tasks[0].title, "Powtórka: kwasy");
  assertEquals(tasks[0].subjectId, "chemia");
  assertEquals(tasks[0].dueDate, "2026-09-05");
  assertEquals(tasks[0].estimatedMinutes, 25);
  assertEquals(tasks[0].priority, "high");
  assertEquals(tasks[0].status, "open");

  assertEquals(tasks[1].id, "task-done-1");
  assertEquals(tasks[1].status, "done");
});

Deno.test("serializeTodoFile round-trips open and done sections", () => {
  const original = [
    {
      id: "task-1",
      title: "Matma: funkcje",
      dueDate: "2026-09-10",
      priority: "high" as const,
      status: "open" as const,
      source: "manual" as const,
      estimatedMinutes: 30,
    },
    {
      id: "task-2",
      title: "Chemia: kwasy",
      priority: "medium" as const,
      status: "done" as const,
      source: "ai" as const,
      updatedAt: "2026-09-01T10:00:00.000Z",
    },
  ];

  const serialized = serializeTodoFile(original, "2026-09-02T18:00:00+02:00");
  assertEquals(serialized.includes("## Otwarte"), true);
  assertEquals(serialized.includes("## Zrobione"), true);
  assertEquals(serialized.includes("Matma: funkcje"), true);
  assertEquals(serialized.includes("id: task-1"), true);

  const { tasks } = parseTodoFile(serialized);
  assertEquals(tasks.length, 2);
  assertEquals(tasks.find((t) => t.id === "task-1")?.estimatedMinutes, 30);
  assertEquals(tasks.find((t) => t.id === "task-2")?.status, "done");
});

Deno.test("parseTodoFile ignores non-checkbox lines", () => {
  const { tasks } = parseTodoFile("# Nagłówek\n\nBrak zadań.\n");
  assertEquals(tasks.length, 0);
});
