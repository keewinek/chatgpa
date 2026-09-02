import { assertEquals, assertExists } from "@std/assert";
import { pullChanges, pushChanges } from "./service.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("push upsert + pull returns profile", async ({ db }) => {
  const now = new Date().toISOString();
  const pushResult = await pushChanges(db, [{
    entity: "profile",
    op: "upsert",
    data: {
      id: "default",
      displayName: "Test User",
      timezone: "Europe/Warsaw",
      locale: "pl",
      updatedAt: now,
      createdAt: now,
    },
  }]);

  assertEquals(pushResult.applied, 1);
  assertEquals(pushResult.errors.length, 0);

  const pulled = await pullChanges(db, new Date(0).toISOString());
  assertEquals(pulled.changes.profile.length, 1);
  assertEquals(pulled.changes.profile[0].displayName, "Test User");
});

withTestDb("push skips older change (last-write-wins)", async ({ db }) => {
  const newer = "2026-09-02T12:00:00.000Z";
  const older = "2026-09-02T10:00:00.000Z";

  await pushChanges(db, [{
    entity: "tasks",
    op: "upsert",
    data: {
      id: "task-1",
      title: "Nowa wersja",
      priority: "high",
      source: "manual",
      status: "open",
      updatedAt: newer,
      createdAt: newer,
    },
  }]);

  const stale = await pushChanges(db, [{
    entity: "tasks",
    op: "upsert",
    data: {
      id: "task-1",
      title: "Stara wersja",
      priority: "low",
      source: "manual",
      status: "open",
      updatedAt: older,
      createdAt: older,
    },
  }]);

  assertEquals(stale.skipped, 1);

  const pulled = await pullChanges(db, new Date(0).toISOString());
  assertEquals(pulled.changes.tasks[0].title, "Nowa wersja");
});

withTestDb("push delete soft-deletes file node", async ({ db }) => {
  const now = new Date().toISOString();
  await pushChanges(db, [{
    entity: "file_nodes",
    op: "upsert",
    data: {
      id: "file-1",
      path: "~/notes/test.md",
      kind: "file",
      content: "# Test",
      updatedAt: now,
      createdAt: now,
    },
  }]);

  await pushChanges(db, [{
    entity: "file_nodes",
    op: "delete",
    id: "file-1",
  }]);

  const pulled = await pullChanges(db, now);
  const deleted = pulled.changes.file_nodes.find((row) => row.id === "file-1");
  assertExists(deleted);
  assertEquals(deleted.deletedAt !== null, true);
});
