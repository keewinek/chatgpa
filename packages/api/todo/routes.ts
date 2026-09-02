import { Hono } from "hono";
import type { TaskPriority, TaskSource, TaskStatus } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import {
  addTask,
  completeTask,
  deleteTask,
  listTasks,
  updateTask,
} from "./service.ts";

function parseStatus(value: string | undefined): TaskStatus | null {
  if (!value) return null;
  if (value === "open" || value === "done" || value === "cancelled") return value;
  return null;
}

function parsePriority(value: unknown): TaskPriority | undefined {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function parseSource(value: unknown): TaskSource | undefined {
  if (value === "manual" || value === "librus" || value === "ai" || value === "plan") return value;
  return undefined;
}

export function createTodoRoutes(getDatabase: () => AppDatabase | null) {
  const todo = new Hono();

  todo.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const status = parseStatus(c.req.query("status") ?? undefined);
    if (c.req.query("status") && !status) {
      return c.json({ error: "status musi być open, done lub cancelled" }, 400);
    }

    const dueBefore = c.req.query("dueBefore") ?? undefined;
    const tasks = await listTasks(db, { status: status ?? undefined, dueBefore });
    return c.json({ tasks });
  });

  todo.post("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body || typeof body.title !== "string" || !body.title.trim()) {
      return c.json({ error: "Pole title jest wymagane" }, 400);
    }

    try {
      const task = await addTask(db, {
        title: body.title,
        subjectId: typeof body.subjectId === "string" ? body.subjectId : undefined,
        dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
        priority: parsePriority(body.priority),
        estimatedMinutes: typeof body.estimatedMinutes === "number"
          ? body.estimatedMinutes
          : undefined,
        source: parseSource(body.source),
        roiScore: typeof body.roiScore === "number" ? body.roiScore : undefined,
      });
      return c.json({ task }, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });

  todo.patch("/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    const status = typeof body.status === "string" ? parseStatus(body.status) : undefined;
    if (typeof body.status === "string" && !status) {
      return c.json({ error: "status musi być open, done lub cancelled" }, 400);
    }

    const task = await updateTask(db, c.req.param("id"), {
      title: typeof body.title === "string" ? body.title : undefined,
      subjectId: body.subjectId === null
        ? null
        : typeof body.subjectId === "string"
        ? body.subjectId
        : undefined,
      dueDate: body.dueDate === null
        ? null
        : typeof body.dueDate === "string"
        ? body.dueDate
        : undefined,
      priority: parsePriority(body.priority),
      status: status ?? undefined,
      estimatedMinutes: body.estimatedMinutes === null
        ? null
        : typeof body.estimatedMinutes === "number"
        ? body.estimatedMinutes
        : undefined,
      source: parseSource(body.source),
      roiScore: body.roiScore === null
        ? null
        : typeof body.roiScore === "number"
        ? body.roiScore
        : undefined,
    });

    if (!task) return c.json({ error: "Nie znaleziono zadania" }, 404);
    return c.json({ task });
  });

  todo.post("/:id/complete", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const task = await completeTask(db, c.req.param("id"));
    if (!task) return c.json({ error: "Nie znaleziono zadania" }, 404);
    return c.json({ task });
  });

  todo.delete("/:id", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const task = await deleteTask(db, c.req.param("id"));
    if (!task) return c.json({ error: "Nie znaleziono zadania" }, 404);
    return c.json({ task });
  });

  return todo;
}
