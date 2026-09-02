import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fromFileUrl } from "@std/path/from-file-url";
import { dirname, join } from "@std/path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getDatabaseUrl } from "./client.ts";

const migrationsFolder = join(
  dirname(fromFileUrl(import.meta.url)),
  "..",
  "migrations",
);

/** Apply SQL migrations from packages/api/migrations. */
export async function runMigrations(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const migrationClient = postgres(url, { max: 1 });
  const db = drizzle(migrationClient);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await migrationClient.end({ timeout: 5 });
  }
}

if (import.meta.main) {
  await runMigrations();
  console.log("Migrations applied.");
}
