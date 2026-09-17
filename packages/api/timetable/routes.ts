import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import { loadStoredGroupPrefs } from "../fs/groups.ts";
import {
  DEFAULT_GROUP_PREFS,
  formatCurrentLesson,
  formatDaySchedule,
  formatTimetableForAi,
  getWarsawNow,
  weekdayFromDate,
} from "@chatgpa/core";

export function createTimetableRoutes(getDatabase: () => AppDatabase | null) {
  const timetable = new Hono();

  timetable.get("/", async (c) => {
    const db = getDatabase();
    const prefs = db ? (await loadStoredGroupPrefs(db)) ?? DEFAULT_GROUP_PREFS : DEFAULT_GROUP_PREFS;
    const day = weekdayFromDate(getWarsawNow());

    return c.json({
      current: formatCurrentLesson(prefs),
      today: day ? formatDaySchedule(day, prefs) : "Dziś weekend — brak lekcji.",
      full: formatTimetableForAi(prefs),
    });
  });

  return timetable;
}
