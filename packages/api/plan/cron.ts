import { getDb } from "../db/client.ts";
import { formatWarsawIsoDate } from "./distribute.ts";
import { generateDailyPlan } from "./service.ts";

let cronRegistered = false;

export function registerPlanCronJobs(): void {
  if (cronRegistered) return;
  cronRegistered = true;

  Deno.cron("daily study plan", "0 6 * * *", async () => {
    const db = getDb();
    if (!db) {
      console.warn("[cron] daily study plan: brak DATABASE_URL");
      return;
    }

    const date = formatWarsawIsoDate();
    try {
      const plan = await generateDailyPlan(db, date);
      console.log(
        `[cron] plan dzienny ${date}: ${plan.blocks.length} bloków, ${plan.usedMinutes}/${plan.budgetMinutes} min`,
      );
    } catch (err) {
      console.error(
        "[cron] daily study plan failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  });
}
