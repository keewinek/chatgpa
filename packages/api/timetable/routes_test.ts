import { assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /api/timetable returns current/today/full schedule", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/timetable");
    assertEquals(res.status, 200);
    const body = await res.json() as { current: string; today: string; full: string };
    assertEquals(typeof body.current, "string");
    assertEquals(typeof body.today, "string");
    assertEquals(body.full.includes("Matematyka"), true);
  } finally {
    setDbForTests(undefined);
  }
});
