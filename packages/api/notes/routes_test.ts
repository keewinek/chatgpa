import { assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /api/notes lists ~/notes", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/notes");
    assertEquals(res.status, 200);
    const body = await res.json() as { path: string; entries: unknown[] };
    assertEquals(body.path, "~/notes");
    assertEquals(Array.isArray(body.entries), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("notes CRUD via /api/notes", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();

    const mkdirRes = await app.request("/api/notes/mkdir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "chemia" }),
    });
    assertEquals(mkdirRes.status, 200);

    const writeRes = await app.request("/api/notes/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "chemia/kwasy",
        content: "# Kwasy\n\nTreść notatki.",
      }),
    });
    assertEquals(writeRes.status, 200);
    const writeBody = await writeRes.json() as { path: string; created: boolean };
    assertEquals(writeBody.path, "~/notes/chemia/kwasy.md");
    assertEquals(writeBody.created, true);

    const readRes = await app.request(
      "/api/notes/file?path=" + encodeURIComponent("chemia/kwasy.md"),
    );
    assertEquals(readRes.status, 200);
    const readBody = await readRes.json() as { content: string };
    assertEquals(readBody.content.includes("# Kwasy"), true);

    const appendRes = await app.request("/api/notes/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "chemia/kwasy", content: "\n## Zasady" }),
    });
    assertEquals(appendRes.status, 200);

    const read2 = await app.request(
      "/api/notes/file?path=" + encodeURIComponent("chemia/kwasy"),
    );
    const read2Body = await read2.json() as { content: string };
    assertEquals(read2Body.content.includes("## Zasady"), true);

    const listRes = await app.request("/api/notes?path=chemia");
    const listBody = await listRes.json() as { entries: Array<{ name: string }> };
    assertEquals(listBody.entries.some((e) => e.name === "kwasy.md"), true);

    const delRes = await app.request(
      "/api/notes/file?path=" + encodeURIComponent("chemia/kwasy.md"),
      { method: "DELETE" },
    );
    assertEquals(delRes.status, 200);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("notes rejects paths outside ~/notes", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/notes/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "../todo/global.todo", content: "hack" }),
    });
    assertEquals(res.status, 400);
  } finally {
    setDbForTests(undefined);
  }
});
