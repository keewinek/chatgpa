import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createFsRoutes } from "./routes.ts";
import { SEED_DIRECTORIES } from "./seed.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /api/fs seeds and lists home directories", async ({ db }) => {
  const app = new Hono();
  app.route("/api/fs", createFsRoutes(() => db));

  const res = await app.request("/api/fs?path=~");
  assertEquals(res.status, 200);
  const body = await res.json() as { path: string; entries: { name: string; kind: string }[] };
  assertEquals(body.path, "~");
  assertEquals(body.entries.length, SEED_DIRECTORIES.length);
  assertEquals(body.entries.every((e) => e.kind === "directory"), true);
  const names = body.entries.map((e) => e.name).sort();
  assertEquals(names, [
    "books",
    "calendar",
    "memory",
    "notes",
    "plans",
    "profile",
    "school",
    "todo",
  ]);
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

  const mkdirRes = await app.request("/api/fs/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "~/notes/chemia" }),
  });
  assertEquals(mkdirRes.status, 200);

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
