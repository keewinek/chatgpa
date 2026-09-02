import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import { fsRead } from "../fs/service.ts";
import { createTodoRoutes } from "./routes.ts";
import { GLOBAL_TODO_PATH } from "./service.ts";

withTestDb("todo CRUD API flow", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = new Hono();
    app.route("/api/todos", createTodoRoutes(() => db));

    const createRes = await app.request("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Powtórka: kwasy",
        dueDate: "2026-09-05",
        priority: "high",
        estimatedMinutes: 25,
      }),
    });
    assertEquals(createRes.status, 201);
    const created = await createRes.json() as { task: { id: string; title: string } };
    assertEquals(created.task.title, "Powtórka: kwasy");

    const listRes = await app.request("/api/todos?status=open");
    assertEquals(listRes.status, 200);
    const listBody = await listRes.json() as { tasks: { id: string }[] };
    assertEquals(listBody.tasks.length, 1);

    const patchRes = await app.request(`/api/todos/${created.task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Powtórka: kwasy i zasady" }),
    });
    assertEquals(patchRes.status, 200);

    const completeRes = await app.request(`/api/todos/${created.task.id}/complete`, {
      method: "POST",
    });
    assertEquals(completeRes.status, 200);
    const completeBody = await completeRes.json() as { task: { status: string } };
    assertEquals(completeBody.task.status, "done");

    const file = await fsRead(db, GLOBAL_TODO_PATH);
    assertEquals(file.content.includes("Powtórka: kwasy i zasady"), true);
    assertEquals(file.content.includes("[x]"), true);

    const deleteRes = await app.request(`/api/todos/${created.task.id}`, {
      method: "DELETE",
    });
    assertEquals(deleteRes.status, 200);

    const emptyRes = await app.request("/api/todos");
    const emptyBody = await emptyRes.json() as { tasks: unknown[] };
    assertEquals(emptyBody.tasks.length, 0);
  } finally {
    setDbForTests(undefined);
  }
});

Deno.test("todo routes return 503 without database", async () => {
  const app = new Hono();
  app.route("/api/todos", createTodoRoutes(() => null));

  const res = await app.request("/api/todos");
  assertEquals(res.status, 503);
});
