import { assertEquals } from "@std/assert";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import { fsRead } from "../fs/service.ts";
import { addTask, completeTask, deleteTask, listTasks, syncGlobalTodoFile } from "./service.ts";
import { GLOBAL_TODO_PATH } from "./service.ts";

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
