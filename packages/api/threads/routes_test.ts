import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createMigrateRoutes } from "../migrate/routes.ts";
import { createThreadRoutes } from "./routes.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /threads lists with messages", async ({ db }) => {
  const app = new Hono();
  app.route("/api/threads", createThreadRoutes(() => db));

  const createRes = await app.request("/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "API test" }),
  });
  assertEquals(createRes.status, 201);
  const { thread } = await createRes.json() as { thread: { id: string } };

  const msgRes = await app.request(`/api/threads/${thread.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content: "Test" }),
  });
  assertEquals(msgRes.status, 201);

  const listRes = await app.request("/api/threads?include=messages");
  assertEquals(listRes.status, 200);
  const body = await listRes.json() as { threads: Array<{ messages?: unknown[] }> };
  assertEquals(body.threads.length, 1);
  assertEquals(body.threads[0].messages?.length, 1);
});

withTestDb("POST /migrate/local imports store once", async ({ db }) => {
  const app = new Hono();
  app.route("/api/migrate", createMigrateRoutes(() => db));

  const res = await app.request("/api/migrate/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store: {
        activeSessionId: "local-1",
        sessions: [{
          id: "local-1",
          title: "Z localStorage",
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_100_000,
          messages: [{ id: "msg-1", role: "user", content: "Import" }],
        }],
      },
    }),
  });
  assertEquals(res.status, 200);

  const again = await app.request("/api/migrate/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store: { sessions: [] } }),
  });
  assertEquals(again.status, 409);
});

Deno.test("thread routes return 503 without database", async () => {
  const app = new Hono();
  app.route("/api/threads", createThreadRoutes(() => null));

  const res = await app.request("/api/threads");
  assertEquals(res.status, 503);
});
