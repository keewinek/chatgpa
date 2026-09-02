import { assertEquals } from "@std/assert";
import { withTestDb } from "../db/test-helpers.ts";
import {
  createMessage,
  createThread,
  deleteMessage,
  deleteThread,
  getThread,
  listThreads,
  migrateLocalStore,
  updateMessage,
  updateThread,
} from "./service.ts";

withTestDb("thread CRUD", async ({ db }) => {
  const thread = await createThread(db, { title: "Test rozmowa" });
  assertEquals(thread.title, "Test rozmowa");

  const message = await createMessage(db, thread.id, {
    role: "user",
    content: "Cześć",
  });
  assertEquals(message?.content, "Cześć");

  const updated = await updateThread(db, thread.id, { title: "Zmieniony" });
  assertEquals(updated?.title, "Zmieniony");

  const patched = await updateMessage(db, thread.id, message!.id, {
    content: "Cześć!",
    model: "gemini",
  });
  assertEquals(patched?.content, "Cześć!");
  assertEquals(patched?.model, "gemini");

  const full = await getThread(db, thread.id);
  assertEquals(full?.messages?.length, 1);

  await deleteMessage(db, thread.id, message!.id);
  const afterDeleteMsg = await getThread(db, thread.id);
  assertEquals(afterDeleteMsg?.messages?.length, 0);

  await deleteThread(db, thread.id);
  const list = await listThreads(db);
  assertEquals(list.length, 0);
});

withTestDb("migrateLocalStore imports sessions", async ({ db }) => {
  const migrated = await migrateLocalStore(db, {
    activeSessionId: "s1",
    sessions: [{
      id: "s1",
      title: "Stara rozmowa",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
      messages: [{
        id: "m1",
        role: "user",
        content: "Hej",
      }],
    }],
  });

  assertEquals(migrated.threads, 1);
  assertEquals(migrated.messages, 1);

  const threads = await listThreads(db, { includeMessages: true });
  assertEquals(threads.length, 1);
  assertEquals(threads[0].title, "Stara rozmowa");
  assertEquals(threads[0].messages?.[0].content, "Hej");
});
