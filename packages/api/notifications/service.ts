import { and, desc, eq, isNull } from "drizzle-orm";
import type { AppNotification, NotificationKind, NotificationPayload } from "@chatgpa/core";
import { parseTimeToMinutes } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { notifications } from "../db/schema.ts";
import { computeFreeSlots } from "../calendar/service.ts";
import { addDaysIso, collectExamAlerts, formatWarsawIsoDate } from "../plan/distribute.ts";
import { examsFromCalendar, generateDailyPlan } from "../plan/service.ts";
import { listEvents } from "../calendar/service.ts";
import type { ExamAlert } from "../plan/types.ts";

export class NotificationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}

export function newNotificationId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rowToNotification(row: typeof notifications.$inferSelect): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    chatPrefill: row.chatPrefill ?? undefined,
    payload: row.payload ?? undefined,
    planDate: row.planDate ?? undefined,
    createdAt: row.createdAt,
    readAt: row.readAt ?? undefined,
  };
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
}

export async function listNotifications(
  db: AppDatabase,
  options: ListNotificationsOptions = {},
): Promise<AppNotification[]> {
  const conditions = [isNull(notifications.deletedAt)];
  if (options.unreadOnly) conditions.push(isNull(notifications.readAt));

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit ?? 50);

  return rows.map(rowToNotification);
}

export async function getNotification(
  db: AppDatabase,
  id: string,
): Promise<AppNotification | null> {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), isNull(notifications.deletedAt)))
    .limit(1);
  return rows[0] ? rowToNotification(rows[0]) : null;
}

export async function hasNotification(
  db: AppDatabase,
  kind: NotificationKind,
  planDate: string,
  dedupeKey?: string,
): Promise<boolean> {
  const rows = await db
    .select({ payload: notifications.payload })
    .from(notifications)
    .where(and(
      eq(notifications.kind, kind),
      eq(notifications.planDate, planDate),
      isNull(notifications.deletedAt),
    ));

  if (!rows.length) return false;
  if (!dedupeKey) return true;

  return rows.some((row) => {
    const payload = row.payload as NotificationPayload | null;
    return `${payload?.alertKind ?? ""}:${payload?.examSubject ?? ""}` === dedupeKey;
  });
}

export interface CreateNotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  chatPrefill?: AppNotification["chatPrefill"];
  payload?: NotificationPayload;
  planDate?: string;
}

export async function createNotification(
  db: AppDatabase,
  input: CreateNotificationInput,
): Promise<AppNotification> {
  const now = new Date().toISOString();
  const row = {
    id: newNotificationId(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    chatPrefill: input.chatPrefill ?? null,
    payload: input.payload ?? null,
    planDate: input.planDate ?? null,
    readAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.insert(notifications).values(row);
  return rowToNotification(row);
}

export async function markNotificationRead(
  db: AppDatabase,
  id: string,
): Promise<AppNotification | null> {
  const existing = await getNotification(db, id);
  if (!existing) return null;
  if (existing.readAt) return existing;

  const now = new Date().toISOString();
  await db
    .update(notifications)
    .set({ readAt: now, updatedAt: now })
    .where(eq(notifications.id, id));

  return { ...existing, readAt: now };
}

export function getWarsawClock(now = new Date()): {
  date: string;
  timeMinutes: number;
  hour: number;
} {
  const date = formatWarsawIsoDate(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { date, timeMinutes: hour * 60 + minute, hour };
}

export function isPushQuietHours(
  studyEndHard: string,
  timeMinutes: number,
  examMorning = false,
): boolean {
  if (examMorning && timeMinutes >= 7 * 60 && timeMinutes < 8 * 60) return false;
  return timeMinutes >= parseTimeToMinutes(studyEndHard);
}

function notificationBodyFromMessage(message: string, max = 120): string {
  const line = message.split("\n").find((l) => l.trim())?.trim() ?? message;
  const plain = line.replace(/\*\*/g, "").replace(/^#+\s*/, "");
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trim()}…`;
}

function examAlertTitle(alert: ExamAlert): string {
  if (alert.kind === "t7") return `Za tydzień: ${alert.title}`;
  if (alert.kind === "t3") return `Za 3 dni: ${alert.title}`;
  return `Jutro sprawdzian: ${alert.title}`;
}

function examAlertBody(alert: ExamAlert): string {
  if (alert.kind === "t7") {
    return `Za tydzień ${alert.title} — dziś 15–20 min powtórki.`;
  }
  if (alert.kind === "t3") {
    return `Za 3 dni sprawdzian — zaplanowano powtórkę w planie tygodnia.`;
  }
  return `Jutro sprawdzian z ${alert.title} — checklista w planie dnia.`;
}

function examAlertChatPrefill(alert: ExamAlert): string {
  if (alert.kind === "t7") {
    return `Za **tydzień** masz sprawdzian z **${alert.title}**.\n\nDziś wystarczy **15–20 min** lekkiej powtórki — bez paniki. Zadanie dodałem do TODO na dziś.\n\nJeśli dziś masz coś pilnego, napisz — przesunę na inny dzień.`;
  }
  if (alert.kind === "t3") {
    return `Za **3 dni** sprawdzian z **${alert.title}**.\n\nW planie tygodnia są już bloki powtórki — dziś kontynuuj małymi krokami.\n\nCoś nie pasuje? Napisz, a przesunę zadania.`;
  }
  return `**Jutro** sprawdzian z **${alert.title}**.\n\n### Checklista\n- Przejrzyj notatki i błędy z poprzednich kartkówek\n- 2–3 przykładowe zadania „na czas”\n- Sen i śniadanie — bez nauki do późna\n\nMasz dziś inne plany? Napisz — dostosujemy plan.`;
}

export async function createDailyPlanNotification(
  db: AppDatabase,
  date: string,
): Promise<AppNotification | null> {
  if (await hasNotification(db, "daily_plan", date)) return null;

  const plan = await generateDailyPlan(db, date);
  const title = `Plan na ${plan.weekdayLabel}`;
  const body = notificationBodyFromMessage(plan.message);

  const notification = await createNotification(db, {
    kind: "daily_plan",
    title,
    body,
    planDate: date,
    chatPrefill: { role: "assistant", content: plan.message },
    payload: {
      planDate: date,
      todoToday: plan.tasks,
      freeMinutes: plan.budgetMinutes,
    },
  });

  return notification;
}

export async function createExamAlertNotifications(
  db: AppDatabase,
  date: string,
): Promise<AppNotification[]> {
  const events = await listEvents(db, date, addDaysIso(date, 14));
  const exams = examsFromCalendar(events);
  const alerts = collectExamAlerts(exams, date);
  const created: AppNotification[] = [];

  for (const alert of alerts) {
    const alertKey = `${alert.kind}:${alert.title}`;
    if (await hasNotification(db, "exam_alert", date, alertKey)) continue;

    const notification = await createNotification(db, {
      kind: "exam_alert",
      title: examAlertTitle(alert),
      body: examAlertBody(alert),
      planDate: date,
      chatPrefill: { role: "assistant", content: examAlertChatPrefill(alert) },
      payload: {
        planDate: date,
        examSubject: alert.title,
        daysUntil: alert.daysUntil,
        alertKind: alert.kind,
      },
    });
    created.push(notification);
  }

  return created;
}

export interface ScheduledNotificationResult {
  dailyPlan: AppNotification | null;
  examAlerts: AppNotification[];
}

/** Hourly job: after-school plan + exam alerts when due. */
export async function runScheduledNotifications(
  db: AppDatabase,
  now = new Date(),
): Promise<ScheduledNotificationResult> {
  const clock = getWarsawClock(now);
  const freeSlots = await computeFreeSlots(db, clock.date);

  let dailyPlan: AppNotification | null = null;
  const examAlerts: AppNotification[] = [];

  const afterSchoolDue = freeSlots.notificationAt &&
    clock.timeMinutes >= parseTimeToMinutes(freeSlots.notificationAt);

  if (afterSchoolDue && freeSlots.isSchoolDay) {
    dailyPlan = await createDailyPlanNotification(db, clock.date);
  }

  const morningWindow = clock.hour >= 6 && clock.hour < 9;

  if (morningWindow || afterSchoolDue) {
    const alerts = await createExamAlertNotifications(db, clock.date);
    examAlerts.push(...alerts);
  }

  return { dailyPlan, examAlerts };
}

export async function sendPushForNotification(
  db: AppDatabase,
  notification: AppNotification,
): Promise<number> {
  const { sendPushToAll } = await import("./push.ts");
  return sendPushToAll(db, {
    title: notification.title,
    body: notification.body,
    tag: notification.id,
    url: `/?notification=${encodeURIComponent(notification.id)}`,
  });
}
