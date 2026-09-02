import { assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { addEvent } from "../calendar/service.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import { fsRead } from "../fs/service.ts";
import { generateDailyPlan, PLANS_VIRTUAL_ROOT } from "./service.ts";

withTestDb("generateDailyPlan — plik .plan, TODO i study_block", async ({ db }) => {
  setDbForTests(db);
  try {
    await addEvent(db, {
      title: "Sprawdzian Chemia",
      kind: "exam",
      start: "2026-09-09T08:00:00+02:00",
      source: "manual",
    });

    const plan = await generateDailyPlan(db, "2026-09-02");
    assertEquals(plan.date, "2026-09-02");
    assertEquals(plan.blocks.length >= 1, true);
    assertEquals(plan.examAlerts.some((a) => a.kind === "t7"), true);
    assertEquals(plan.tasks.some((t) => t.scheduledFor === "2026-09-02"), true);
    assertEquals(plan.message.length > 20, true);

    const file = await fsRead(db, `${PLANS_VIRTUAL_ROOT}/2026-09-02.plan`);
    assertEquals(file.content.includes("# Plan — 2026-09-02"), true);
    assertEquals(file.content.includes("## Bloki"), true);

    const events = await import("../calendar/service.ts").then((m) =>
      m.listEvents(db, "2026-09-02", "2026-09-02")
    );
    assertEquals(events.some((e) => e.kind === "study_block"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("POST /api/plan/generate?date=...", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/plan/generate?date=2026-09-03", { method: "POST" });
    assertEquals(res.status, 200);
    const body = await res.json() as {
      date: string;
      blocks: unknown[];
      planFilePath: string;
      message: string;
    };
    assertEquals(body.date, "2026-09-03");
    assertEquals(Array.isArray(body.blocks), true);
    assertEquals(body.planFilePath, "~/plans/2026-09-03.plan");
    assertEquals(typeof body.message, "string");
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("POST /api/plan/generate — invalid date", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/plan/generate?date=invalid", { method: "POST" });
    assertEquals(res.status, 400);
  } finally {
    setDbForTests(undefined);
  }
});
