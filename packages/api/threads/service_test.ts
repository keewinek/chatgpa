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

withTestDb("createThread revives a soft-deleted id instead of crashing", async ({ db }) => {
  const thread = await createThread(db, { id: "t1", title: "Rozmowa" });
  await createMessage(db, thread.id, { id: "m1", role: "user", content: "Cześć" });
  await deleteThread(db, thread.id);

  // Same id as before deletion — simulates a client re-pushing a locally cached
  // thread whose server copy was soft-deleted (e.g. deleted on another device).
  const revived = await createThread(db, { id: "t1", title: "Rozmowa wznowiona" });
  assertEquals(revived.id, "t1");
  assertEquals(revived.title, "Rozmowa wznowiona");

  const found = await getThread(db, "t1");
  assertEquals(found?.title, "Rozmowa wznowiona");

  const revivedMsg = await createMessage(db, "t1", { id: "m1", role: "user", content: "Cześć!" });
  assertEquals(revivedMsg?.content, "Cześć!");
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

withTestDb(
  "migrateLocalStore is retry-safe (no crash on already-migrated data)",
  async ({ db }) => {
    const input = {
      activeSessionId: "s1",
      sessions: [{
        id: "s1",
        title: "Stara rozmowa",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
        messages: [{ id: "m1", role: "user" as const, content: "Hej" }],
      }],
    };

    const first = await migrateLocalStore(db, input);
    assertEquals(first.threads, 1);
    assertEquals(first.messages, 1);

    // Simulates the client retrying after its "serverMigrated" flag failed to persist
    // (e.g. a network hiccup) — must not throw a duplicate-key error.
    const retry = await migrateLocalStore(db, input);
    assertEquals(retry.threads, 0);
    assertEquals(retry.messages, 0);

    const threads = await listThreads(db, { includeMessages: true });
    assertEquals(threads.length, 1);
    assertEquals(threads[0].messages?.length, 1);
  },
);
