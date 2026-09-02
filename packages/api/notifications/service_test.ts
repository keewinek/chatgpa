import { assertEquals } from "@std/assert";
import { parseTimeToMinutes } from "@chatgpa/core";
import { addEvent } from "../calendar/service.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import {
  createDailyPlanNotification,
  createExamAlertNotifications,
  getWarsawClock,
  hasNotification,
  isPushQuietHours,
  listNotifications,
  markNotificationRead,
  runScheduledNotifications,
} from "./service.ts";

withTestDb("createDailyPlanNotification — plan + chatPrefill + TODO", async ({ db }) => {
  setDbForTests(db);
  try {
    await addEvent(db, {
      title: "Sprawdzian Chemia",
      kind: "exam",
      start: "2026-09-09T08:00:00+02:00",
      source: "manual",
    });

    const notification = await createDailyPlanNotification(db, "2026-09-02");
    assertEquals(notification?.kind, "daily_plan");
    assertEquals(notification?.planDate, "2026-09-02");
    assertEquals(notification?.chatPrefill?.role, "assistant");
    assertEquals((notification?.chatPrefill?.content.length ?? 0) > 20, true);
    assertEquals(typeof notification?.payload?.freeMinutes, "number");
    assertEquals(Array.isArray(notification?.payload?.todoToday), true);

    const duplicate = await createDailyPlanNotification(db, "2026-09-02");
    assertEquals(duplicate, null);
    assertEquals(await hasNotification(db, "daily_plan", "2026-09-02"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("createExamAlertNotifications — T-7 dedupe", async ({ db }) => {
  setDbForTests(db);
  try {
    await addEvent(db, {
      title: "Sprawdzian Chemia",
      kind: "exam",
      start: "2026-09-09T08:00:00+02:00",
      source: "manual",
    });

    const first = await createExamAlertNotifications(db, "2026-09-02");
    assertEquals(first.length, 1);
    assertEquals(first[0].kind, "exam_alert");
    assertEquals(first[0].payload?.alertKind, "t7");

    const second = await createExamAlertNotifications(db, "2026-09-02");
    assertEquals(second.length, 0);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("markNotificationRead sets readAt", async ({ db }) => {
  setDbForTests(db);
  try {
    const created = await createDailyPlanNotification(db, "2026-09-03");
    assertEquals(created?.readAt, undefined);

    const read = await markNotificationRead(db, created!.id);
    assertEquals(typeof read?.readAt, "string");

    const unread = await listNotifications(db, { unreadOnly: true });
    assertEquals(unread.some((n) => n.id === created!.id), false);
  } finally {
    setDbForTests(undefined);
  }
});

Deno.test("isPushQuietHours — after studyEndHard", () => {
  assertEquals(isPushQuietHours("21:30", parseTimeToMinutes("22:00")), true);
  assertEquals(isPushQuietHours("21:30", parseTimeToMinutes("18:00")), false);
});

Deno.test("isPushQuietHours — T-1 morning exception", () => {
  assertEquals(isPushQuietHours("21:30", parseTimeToMinutes("07:30"), true), false);
});

Deno.test("getWarsawClock returns date and minutes", () => {
  const clock = getWarsawClock(new Date("2026-09-02T14:30:00+02:00"));
  assertEquals(clock.date, "2026-09-02");
  assertEquals(clock.timeMinutes, 14 * 60 + 30);
});

withTestDb("runScheduledNotifications — after school when time passed", async ({ db }) => {
  setDbForTests(db);
  try {
    const freeSlots = await import("../calendar/service.ts").then((m) =>
      m.computeFreeSlots(db, "2026-09-02")
    );
    assertEquals(freeSlots.notificationAt !== null, true);

    const afterSchool = new Date("2026-09-02T16:00:00+02:00");
    const result = await runScheduledNotifications(db, afterSchool);
    assertEquals(result.dailyPlan?.kind, "daily_plan");
  } finally {
    setDbForTests(undefined);
  }
});
