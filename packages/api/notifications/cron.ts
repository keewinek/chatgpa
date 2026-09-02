import { getDb } from "../db/client.ts";
import { getProfile } from "../profile/service.ts";
import {
  getWarsawClock,
  isPushQuietHours,
  runScheduledNotifications,
  sendPushForNotification,
} from "./service.ts";

let cronRegistered = false;

export function registerNotificationCronJobs(): void {
  if (cronRegistered) return;
  cronRegistered = true;

  Deno.cron("scheduled notifications", "*/15 * * * *", async () => {
    const db = getDb();
    if (!db) {
      console.warn("[cron] scheduled notifications: brak DATABASE_URL");
      return;
    }

    try {
      const result = await runScheduledNotifications(db);
      const created = [
        ...(result.dailyPlan ? [result.dailyPlan] : []),
        ...result.examAlerts,
      ];

      const profile = await getProfile(db);
      const clock = getWarsawClock();
      const examMorning = clock.hour >= 7 && clock.hour < 8;
      const quiet = isPushQuietHours(profile.studyEndHard, clock.timeMinutes, examMorning);

      if (!quiet) {
        for (const notification of created) {
          const sent = await sendPushForNotification(db, notification);
          if (sent > 0) {
            console.log(`[cron] push wysłany (${sent}): ${notification.title}`);
          }
        }
      }

      if (result.dailyPlan) {
        console.log(`[cron] powiadomienie po szkole: ${result.dailyPlan.title}`);
      }
      if (result.examAlerts.length) {
        console.log(`[cron] alerty sprawdzianowe: ${result.examAlerts.length}`);
      }
    } catch (err) {
      console.error(
        "[cron] scheduled notifications failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  });
}
