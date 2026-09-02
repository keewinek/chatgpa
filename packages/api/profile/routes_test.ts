import { assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";

withTestDb("GET /api/profile returns defaults", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/profile");
    assertEquals(res.status, 200);
    const body = await res.json() as {
      commuteAfterSchoolMinutes: number;
      studyEndPreferred: string;
    };
    assertEquals(body.commuteAfterSchoolMinutes, 60);
    assertEquals(body.studyEndPreferred, "21:00");
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("PUT /api/profile updates fields", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showerAndBreakMinutes: 45 }),
    });
    assertEquals(res.status, 200);
    const body = await res.json() as { showerAndBreakMinutes: number };
    assertEquals(body.showerAndBreakMinutes, 45);
  } finally {
    setDbForTests(undefined);
  }
});
