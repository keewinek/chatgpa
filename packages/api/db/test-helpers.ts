import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { fromFileUrl } from "@std/path/from-file-url";
import * as schema from "./schema.ts";
import type { AppDatabase } from "./client.ts";

export type TestDb = {
  db: AppDatabase;
  close: () => Promise<void>;
};

/** In-memory PostgreSQL (PGLite) for integration tests. */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const migrationsDir = fromFileUrl(new URL("../migrations", import.meta.url));
  const migrationFiles = [];
  for await (const entry of Deno.readDir(migrationsDir)) {
    if (entry.isFile && entry.name.endsWith(".sql")) {
      migrationFiles.push(entry.name);
    }
  }
  migrationFiles.sort();

  for (const file of migrationFiles) {
    const sql = await Deno.readTextFile(`${migrationsDir}/${file}`);
    const statements = sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.exec(statement);
    }
  }

  const db = drizzle(client, { schema });
  return {
    db: db as unknown as AppDatabase,
    close: () => client.close(),
  };
}

export function withTestDb(
  name: string,
  fn: (ctx: TestDb) => Promise<void>,
): void {
  Deno.test(name, async () => {
    const ctx = await createTestDb();
    try {
      await fn(ctx);
    } finally {
      await ctx.close();
    }
  });
}
