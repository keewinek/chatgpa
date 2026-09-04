import { assertEquals } from "@std/assert";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import { fsRead, fsWrite } from "../fs/service.ts";
import {
  addTask,
  completeTask,
  deleteTask,
  GLOBAL_TODO_PATH,
  listTasks,
  syncGlobalTodoFile,
} from "./service.ts";

withTestDb("addTask syncs global.todo file", async ({ db }) => {
  setDbForTests(db);
  try {
    await addTask(db, {
      title: "Zadanie testowe",
      dueDate: "2026-09-05",
      priority: "high",
      estimatedMinutes: 20,
    });
    await syncGlobalTodoFile(db);
    const file = await fsRead(db, GLOBAL_TODO_PATH);
    assertEquals(file.content.includes("Zadanie testowe"), true);
    assertEquals(file.content.includes("due: 2026-09-05"), true);
    assertEquals(file.content.includes("20min"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("completeTask and deleteTask update list", async ({ db }) => {
  setDbForTests(db);
  try {
    const task = await addTask(db, { title: "Do zrobienia" });
    await completeTask(db, task.id);
    const done = await listTasks(db, { status: "done" });
    assertEquals(done.length, 1);

    await deleteTask(db, task.id);
    const all = await listTasks(db);
    assertEquals(all.length, 0);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("editing global.todo removes tasks from list", async ({ db }) => {
  setDbForTests(db);
  try {
    const a = await addTask(db, { title: "Zadanie A" });
    await addTask(db, { title: "Zadanie B" });
    assertEquals((await listTasks(db)).length, 2);

    const file = await fsRead(db, GLOBAL_TODO_PATH);
    const kept = file.content
      .split("\n")
      .filter((line) => !line.includes(a.id))
      .join("\n");
    await fsWrite(db, GLOBAL_TODO_PATH, kept);

    const after = await listTasks(db);
    assertEquals(after.length, 1);
    assertEquals(after[0].title, "Zadanie B");
  } finally {
    setDbForTests(undefined);
  }
});
