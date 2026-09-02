import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

let sql: ReturnType<typeof postgres> | null = null;
let db: AppDatabase | null = null;
let testDbOverride: AppDatabase | null | undefined;

export function getDatabaseUrl(): string | undefined {
  return Deno.env.get("DATABASE_URL")?.trim() || undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl()) || testDbOverride !== undefined;
}

/** Lazily connect using DATABASE_URL. Returns null when unset. */
export function getDb(): AppDatabase | null {
  if (testDbOverride !== undefined) return testDbOverride;
  const url = getDatabaseUrl();
  if (!url) return null;
  if (!db) {
    sql = postgres(url, { max: 10 });
    db = drizzle(sql, { schema });
  }
  return db;
}

/** Inject in-memory DB for integration tests. Pass undefined to clear override. */
export function setDbForTests(database: AppDatabase | null | undefined): void {
  testDbOverride = database;
}

/** Close the pooled connection (tests / shutdown). */
export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
    db = null;
  }
}

/** Reset singleton — for tests only. */
export function resetDbForTests(): void {
  db = null;
  sql = null;
  testDbOverride = undefined;
}

export async function checkDatabaseHealth(): Promise<"ok" | "unconfigured" | "error"> {
  const database = getDb();
  if (!database) return "unconfigured";
  try {
    await database.execute("select 1 as ok");
    return "ok";
  } catch {
    return "error";
  }
}
