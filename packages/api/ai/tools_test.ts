import { assertEquals } from "@std/assert";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import { createMemoryStore, executeActions } from "./tools.ts";
import { MemoryStore } from "../memory/service.ts";

Deno.test("memory.remember adds long-term fact", async () => {
  const store = new MemoryStore();
  const { results, memory: updated } = await executeActions(
    [{ tool: "memory.remember", args: { text: "Klasa 3A", kind: "long" } }],
    store,
  );
  assertEquals(results[0].ok, true);
  assertEquals(updated.length, 1);
  assertEquals(updated[0].content, "Klasa 3A");
  assertEquals(updated[0].kind, "long");
});

Deno.test("memory.remember adds short-term fact with expiry", async () => {
  const store = new MemoryStore();
  const { results, memory: updated } = await executeActions(
    [{ tool: "memory.remember", args: { text: "Dziś lekarz", kind: "short", expiresInDays: 3 } }],
    store,
  );
  assertEquals(results[0].ok, true);
  assertEquals(updated[0].kind, "short");
  assertEquals(Boolean(updated[0].expiresAt), true);
});

Deno.test("calc.eval computes expression", async () => {
  const { results } = await executeActions(
    [{ tool: "calc.eval", args: { expression: "(2+3)*4" } }],
    new MemoryStore(),
  );
  assertEquals(results[0].ok, true);
  assertEquals(results[0].output, "20");
});

Deno.test("memory.forget removes fact by text", async () => {
  const store = new MemoryStore([{
    id: "mem-1",
    content: "Stary fakt",
    kind: "long",
    createdAt: new Date().toISOString(),
    source: "ai",
  }, {
    id: "mem-2",
    content: "Inny",
    kind: "long",
    createdAt: new Date().toISOString(),
    source: "ai",
  }]);
  const { results, memory } = await executeActions(
    [{ tool: "memory.forget", args: { text: "stary fakt" } }],
    store,
  );
  assertEquals(results[0].ok, true);
  assertEquals(memory.length, 1);
  assertEquals(memory[0].content, "Inny");
});

Deno.test("memory.clear removes short-term entries", async () => {
  const now = new Date().toISOString();
  const store = new MemoryStore([
    { id: "s1", content: "Krótki", kind: "short", createdAt: now, source: "ai", expiresAt: now },
    { id: "l1", content: "Długi", kind: "long", createdAt: now, source: "ai" },
  ]);
  const { results, memory } = await executeActions(
    [{ tool: "memory.clear", args: { kind: "short" } }],
    store,
  );
  assertEquals(results[0].ok, true);
  assertEquals(memory.length, 1);
  assertEquals(memory[0].kind, "long");
});

Deno.test("file.send stores downloadable file", async () => {
  const { results } = await executeActions(
    [{
      tool: "file.send",
      args: {
        name: "quiz.txt",
        content: "Pytanie 1: …",
        mimeType: "text/plain",
      },
    }],
    new MemoryStore(),
  );
  assertEquals(results[0].ok, true);
  assertEquals(results[0].attachment?.name, "quiz.txt");
  assertEquals(results[0].attachment?.mimeType, "text/plain");
  assertEquals(results[0].output?.includes("/api/files/"), true);
});

withTestDb("fs.write and fs.read via tools", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const write = await executeActions(
      [{ tool: "fs.write", args: { path: "~/todo/global.todo", content: "- [ ] Test" } }],
      store,
    );
    assertEquals(write.results[0].ok, true);

    const read = await executeActions(
      [{ tool: "fs.read", args: { path: "~/todo/global.todo" } }],
      store,
    );
    assertEquals(read.results[0].ok, true);
    assertEquals(read.results[0].output?.includes("- [ ] Test"), true);

    const list = await executeActions([{ tool: "fs.list", args: { path: "~/todo" } }], store);
    assertEquals(list.results[0].ok, true);
    assertEquals(list.results[0].output?.includes("global.todo"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("memory.remember syncs long-term.memory file", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const { results } = await executeActions(
      [{ tool: "memory.remember", args: { text: "Lubię chemię", kind: "long" } }],
      store,
    );
    assertEquals(results[0].ok, true);

    const read = await executeActions(
      [{ tool: "fs.read", args: { path: "~/memory/long-term.memory" } }],
      store,
    );
    assertEquals(read.results[0].ok, true);
    assertEquals(read.results[0].output?.includes("Lubię chemię"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("todo.add and todo.list via tools", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const add = await executeActions(
      [{
        tool: "todo.add",
        args: { title: "Powtórka matma", dueDate: "2026-09-10", priority: "high" },
      }],
      store,
    );
    assertEquals(add.results[0].ok, true);

    const list = await executeActions([{ tool: "todo.list", args: { status: "open" } }], store);
    assertEquals(list.results[0].ok, true);
    assertEquals(list.results[0].output?.includes("Powtórka matma"), true);

    const read = await executeActions(
      [{ tool: "fs.read", args: { path: "~/todo/global.todo" } }],
      store,
    );
    assertEquals(read.results[0].ok, true);
    assertEquals(read.results[0].output?.includes("Powtórka matma"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("todo.complete via tools", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const add = await executeActions(
      [{ tool: "todo.add", args: { title: "Do ukończenia" } }],
      store,
    );
    assertEquals(add.results[0].ok, true);
    const idMatch = add.results[0].output?.match(/\[(task-[^\]]+)\]/);
    assertEquals(Boolean(idMatch), true);
    const id = idMatch![1];

    const complete = await executeActions(
      [{ tool: "todo.complete", args: { id } }],
      store,
    );
    assertEquals(complete.results[0].ok, true);

    const list = await executeActions([{ tool: "todo.list", args: { status: "done" } }], store);
    assertEquals(list.results[0].output?.includes("Do ukończenia"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("notes.write and notes.read via tools", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const write = await executeActions(
      [{
        tool: "notes.write",
        args: { path: "chemia/kwasy", content: "# Kwasy\n\nTreść." },
      }],
      store,
    );
    assertEquals(write.results[0].ok, true);

    const read = await executeActions(
      [{ tool: "notes.read", args: { path: "chemia/kwasy" } }],
      store,
    );
    assertEquals(read.results[0].ok, true);
    assertEquals(read.results[0].output?.includes("# Kwasy"), true);

    const append = await executeActions(
      [{ tool: "notes.append", args: { path: "chemia/kwasy", content: "\n## Zasady" } }],
      store,
    );
    assertEquals(append.results[0].ok, true);

    const list = await executeActions([{ tool: "notes.list", args: { path: "chemia" } }], store);
    assertEquals(list.results[0].ok, true);
    assertEquals(list.results[0].output?.includes("kwasy.md"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("calendar.list returns empty calendar message", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const { results } = await executeActions([{ tool: "calendar.list", args: {} }], store);
    assertEquals(results[0].ok, true);
    assertEquals(results[0].output?.toLowerCase().includes("brak wydarzeń"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("calendar.freeSlots computes study windows", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const { results } = await executeActions(
      [{ tool: "calendar.freeSlots", args: { date: "2026-09-02" } }],
      store,
    );
    assertEquals(results[0].ok, true);
    assertEquals(results[0].output?.includes("Budżet:"), true);
    assertEquals(results[0].output?.includes("21:00"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("calendar.add creates event", async ({ db }) => {
  setDbForTests(db);
  try {
    const store = await createMemoryStore();
    const { results } = await executeActions(
      [{
        tool: "calendar.add",
        args: {
          title: "Lekarz",
          kind: "personal",
          start: "2026-09-03T16:00:00+02:00",
          end: "2026-09-03T17:00:00+02:00",
        },
      }],
      store,
    );
    assertEquals(results[0].ok, true);
    assertEquals(results[0].output?.includes("Lekarz"), true);
  } finally {
    setDbForTests(undefined);
  }
});
