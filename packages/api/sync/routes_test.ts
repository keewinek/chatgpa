import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createSyncRoutes } from "./routes.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /pull returns changes", async ({ db }) => {
  const app = new Hono();
  app.route("/api/sync", createSyncRoutes(() => db));

  const pushRes = await app.request("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      changes: [{
        entity: "chat_threads",
        op: "upsert",
        data: {
          id: "thread-1",
          title: "Pierwszy czat",
          updatedAt: "2026-09-02T12:00:00.000Z",
          createdAt: "2026-09-02T12:00:00.000Z",
        },
      }],
    }),
  });
  assertEquals(pushRes.status, 200);

  const pullRes = await app.request("/api/sync/pull?since=1970-01-01T00:00:00.000Z");
  assertEquals(pullRes.status, 200);
  const body = await pullRes.json() as { changes: { chat_threads: { id: string }[] } };
  assertEquals(body.changes.chat_threads.length, 1);
  assertEquals(body.changes.chat_threads[0].id, "thread-1");
});

Deno.test("sync routes return 503 without database", async () => {
  const app = new Hono();
  app.route("/api/sync", createSyncRoutes(() => null));

  const pullRes = await app.request("/api/sync/pull");
  assertEquals(pullRes.status, 503);

  const pushRes = await app.request("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes: [] }),
  });
  assertEquals(pushRes.status, 503);
});

Deno.test("POST /push validates body", async () => {
  const app = new Hono();
  app.route("/api/sync", createSyncRoutes(() => null));

  const res = await app.request("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 503);
});
