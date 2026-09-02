import type { Task } from "./types.ts";

export type NotificationKind = "daily_plan" | "exam_alert" | "librus_update";

export interface NotificationChatPrefill {
  role: "assistant";
  content: string;
}

export interface NotificationPayload {
  planDate?: string;
  todoToday?: Task[];
  freeMinutes?: number;
  examSubject?: string;
  daysUntil?: number;
  alertKind?: "t7" | "t3" | "t1";
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  chatPrefill?: NotificationChatPrefill;
  payload?: NotificationPayload;
  planDate?: string;
  createdAt: string;
  readAt?: string;
}
