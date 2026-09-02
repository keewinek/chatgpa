import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import { formatWarsawIsoDate } from "./distribute.ts";
import { generateDailyPlan, PlanError } from "./service.ts";

export function createPlanRoutes(getDatabase: () => AppDatabase | null) {
  const plan = new Hono();

  plan.post("/generate", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const date = c.req.query("date") ?? formatWarsawIsoDate();

    try {
      const result = await generateDailyPlan(db, date);
      return c.json({
        date: result.date,
        weekdayLabel: result.weekdayLabel,
        budgetMinutes: result.budgetMinutes,
        usedMinutes: result.usedMinutes,
        blocks: result.blocks,
        tasks: result.tasks,
        message: result.message,
        notes: result.notes,
        examAlerts: result.examAlerts,
        planFilePath: result.planFilePath,
        aiUsed: result.aiUsed,
      });
    } catch (err) {
      if (err instanceof PlanError) {
        return c.json({ error: err.message }, err.status as 400 | 404 | 500);
      }
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  return plan;
}
