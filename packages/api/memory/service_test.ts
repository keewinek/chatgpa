import { eq } from "drizzle-orm";
import { assertEquals } from "@std/assert";
import { setDbForTests } from "../db/client.ts";
import { memoryEntries } from "../db/schema.ts";
import { withTestDb } from "../db/test-helpers.ts";
import {
  clearMemory,
  listMemory,
  migrateLegacyStrings,
  rememberMemory,
  syncLongTermFile,
} from "./service.ts";
import { fsRead } from "../fs/service.ts";

withTestDb("cleanupExpiredShort removes expired entries", async ({ db }) => {
  setDbForTests(db);
  try {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const entry = await rememberMemory(db, { content: "Wygasły", kind: "short", expiresInDays: 1 });
    await db
      .update(memoryEntries)
      .set({ expiresAt: past })
      .where(eq(memoryEntries.id, entry.id));
    await rememberMemory(db, { content: "Aktywny", kind: "short", expiresInDays: 7 });

    // listMemory triggers lazy cleanup
    const active = await listMemory(db, { kind: "short" });
    assertEquals(active.length, 1);
    assertEquals(active[0].content, "Aktywny");
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("migrateLegacyStrings creates long-term entries", async ({ db }) => {
  setDbForTests(db);
  try {
    const count = await migrateLegacyStrings(db, ["Klasa 3A", "Lubi matmę"]);
    assertEquals(count, 2);
    const entries = await listMemory(db, { kind: "long" });
    assertEquals(entries.length, 2);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("syncLongTermFile writes JSONL", async ({ db }) => {
  setDbForTests(db);
  try {
    await rememberMemory(db, { content: "Test fakt", kind: "long" });
    await syncLongTermFile(db);
    const file = await fsRead(db, "~/memory/long-term.memory");
    assertEquals(file.content.includes("Test fakt"), true);
    assertEquals(file.content.includes('"kind":"long"'), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("clearMemory short keeps long entries", async ({ db }) => {
  setDbForTests(db);
  try {
    await rememberMemory(db, { content: "Krótki", kind: "short" });
    await rememberMemory(db, { content: "Długi", kind: "long" });
    const cleared = await clearMemory(db, "short");
    assertEquals(cleared, 1);
    const entries = await listMemory(db);
    assertEquals(entries.length, 1);
    assertEquals(entries[0].kind, "long");
  } finally {
    setDbForTests(undefined);
  }
});
