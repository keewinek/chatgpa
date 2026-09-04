import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createFsRoutes } from "./routes.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /api/fs seeds and lists home directories", async ({ db }) => {
  const app = new Hono();
  app.route("/api/fs", createFsRoutes(() => db));

  const res = await app.request("/api/fs?path=~");
  assertEquals(res.status, 200);
  const body = await res.json() as { path: string; entries: { name: string; kind: string }[] };
  assertEquals(body.path, "~");
  assertEquals(body.entries.every((e) => e.kind === "directory"), true);
  const names = body.entries.map((e) => e.name).sort((a, b) => a.localeCompare(b, "pl"));
  for (
    const dir of [
      "books",
      "calendar",
      "memory",
      "notes",
      "plans",
      "pomodoro",
      "profile",
      "school",
      "todo",
    ]
  ) {
    assertEquals(names.includes(dir), true, `missing seed dir: ${dir}`);
  }
});

withTestDb("fs seeds .ui files in domain folders", async ({ db }) => {
  const app = new Hono();
  app.route("/api/fs", createFsRoutes(() => db));

  const listRes = await app.request(
    "/api/fs?path=" + encodeURIComponent("~/calendar"),
  );
  assertEquals(listRes.status, 200);
  const listBody = await listRes.json() as { entries: { name: string; kind: string }[] };
  assertEquals(listBody.entries.some((e) => e.name === "calendar.ui" && e.kind === "file"), true);
  assertEquals(listBody.entries[0]?.name, "calendar.ui");

  const readRes = await app.request(
    "/api/fs/file?path=" + encodeURIComponent("~/calendar/calendar.ui"),
  );
  assertEquals(readRes.status, 200);
  const readBody = await readRes.json() as { content: string; mimeType: string };
  assertEquals(readBody.mimeType, "application/x-chatgpa-ui");
  const parsed = JSON.parse(readBody.content) as { view: string; title: string };
  assertEquals(parsed.view, "calendar");
  assertEquals(parsed.title, "Kalendarz");

  const groupsRes = await app.request(
    "/api/fs/file?path=" + encodeURIComponent("~/school/groups.json"),
  );
  assertEquals(groupsRes.status, 200);
  const groupsBody = await groupsRes.json() as { content: string };
  const groups = JSON.parse(groupsBody.content) as { language: number };
  assertEquals(groups.language, 1);
});

withTestDb("fs write, read, mkdir, delete flow", async ({ db }) => {
  const app = new Hono();
  app.route("/api/fs", createFsRoutes(() => db));

  const writeRes = await app.request("/api/fs/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "~/notes/test.md",
      content: "# Notatka\n\nTreść testowa.",
    }),
  });
  assertEquals(writeRes.status, 200);
  const writeBody = await writeRes.json() as { path: string; created: boolean };
  assertEquals(writeBody.path, "~/notes/test.md");
  assertEquals(writeBody.created, true);

  const readRes = await app.request("/api/fs/file?path=" + encodeURIComponent("~/notes/test.md"));
  assertEquals(readRes.status, 200);
  const readBody = await readRes.json() as { content: string; mimeType: string };
  assertEquals(readBody.content, "# Notatka\n\nTreść testowa.");
  assertEquals(readBody.mimeType, "text/markdown");

  const listRes = await app.request("/api/fs?path=" + encodeURIComponent("~/notes"));
  assertEquals(listRes.status, 200);
  const listBody = await listRes.json() as { entries: { name: string }[] };
  assertEquals(listBody.entries.some((e) => e.name === "test.md"), true);
  assertEquals(listBody.entries[0]?.name, "notes.ui");

  const mkdirRes = await app.request("/api/fs/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "~/notes/chemia" }),
  });
  assertEquals(mkdirRes.status, 200);

  // Nested file under chemia must not appear as a child of ~/notes.
  await app.request("/api/fs/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "~/notes/chemia/deep.md", content: "x" }),
  });
  const listNotesAgain = await app.request("/api/fs?path=" + encodeURIComponent("~/notes"));
  const notesAgain = await listNotesAgain.json() as { entries: { name: string }[] };
  assertEquals(notesAgain.entries.some((e) => e.name === "chemia"), true);
  assertEquals(notesAgain.entries.some((e) => e.name === "deep.md"), false);
  assertEquals(notesAgain.entries[0]?.name, "notes.ui");

  const delRes = await app.request(
    "/api/fs/file?path=" + encodeURIComponent("~/notes/test.md"),
    { method: "DELETE" },
  );
  assertEquals(delRes.status, 200);

  const missingRes = await app.request(
    "/api/fs/file?path=" + encodeURIComponent("~/notes/test.md"),
  );
  assertEquals(missingRes.status, 404);
});

withTestDb("fs write revives soft-deleted path", async ({ db }) => {
  const app = new Hono();
  app.route("/api/fs", createFsRoutes(() => db));

  const path = "~/notes/revive-me.md";
  const writeRes = await app.request("/api/fs/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content: "v1" }),
  });
  assertEquals(writeRes.status, 200);

  const delRes = await app.request(
    "/api/fs/file?path=" + encodeURIComponent(path),
    { method: "DELETE" },
  );
  assertEquals(delRes.status, 200);

  const rewrite = await app.request("/api/fs/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content: "v2 after delete" }),
  });
  assertEquals(rewrite.status, 200);
  const rewriteBody = await rewrite.json() as { created: boolean };
  assertEquals(rewriteBody.created, true);

  const readRes = await app.request("/api/fs/file?path=" + encodeURIComponent(path));
  assertEquals(readRes.status, 200);
  const readBody = await readRes.json() as { content: string };
  assertEquals(readBody.content, "v2 after delete");
});

withTestDb("fs rejects path traversal", async ({ db }) => {
  const app = new Hono();
  app.route("/api/fs", createFsRoutes(() => db));

  const res = await app.request("/api/fs/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "~/notes/../../secret.txt", content: "hack" }),
  });
  assertEquals(res.status, 400);
});

Deno.test("fs routes return 503 without database", async () => {
  const app = new Hono();
  app.route("/api/fs", createFsRoutes(() => null));

  const res = await app.request("/api/fs?path=~");
  assertEquals(res.status, 503);
});
