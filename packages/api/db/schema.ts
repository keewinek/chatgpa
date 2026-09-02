import type { NotificationChatPrefill, NotificationKind, NotificationPayload } from "@chatgpa/core";
import { date, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

/** Shared sync columns — updatedAt is the pull cursor. */
const syncMeta = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
};

export const profile = pgTable("profile", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  className: text("class_name"),
  targetOverallAverage: real("target_overall_average").notNull().default(4.5),
  dailyStudyMinutes: integer("daily_study_minutes").notNull().default(120),
  quietHours: jsonb("quiet_hours").$type<{ start: string; end: string }>(),
  weakSubjects: jsonb("weak_subjects").$type<string[]>(),
  timezone: text("timezone").notNull().default("Europe/Warsaw"),
  locale: text("locale").notNull().default("pl"),
  ...syncMeta,
});

export type ChatThreadMetadata = {
  notificationContext?: {
    todoToday: unknown[];
    freeMinutes: number;
  };
  clientCreatedAt?: number;
  clientUpdatedAt?: number;
};

export type ChatMessageMetadata = {
  error?: boolean;
  streaming?: boolean;
  toolResults?: Array<{ tool: string; ok: boolean; output?: string; error?: string }>;
  attachments?: unknown[];
};

export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey(),
  title: text("title"),
  mode: text("mode").$type<"ask" | "plan" | "agent" | "focus">(),
  metadata: jsonb("metadata").$type<ChatThreadMetadata>(),
  ...syncMeta,
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => chatThreads.id),
  role: text("role").$type<"system" | "user" | "assistant">().notNull(),
  content: text("content").notNull(),
  model: text("model"),
  provider: text("provider"),
  metadata: jsonb("metadata").$type<ChatMessageMetadata>(),
  ...syncMeta,
});

export const memoryEntries = pgTable("memory_entries", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  kind: text("kind").$type<"short" | "long">().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  source: text("source").$type<"ai" | "user" | "system">().notNull(),
  tags: jsonb("tags").$type<string[]>(),
  chatId: text("chat_id"),
  ...syncMeta,
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subjectId: text("subject_id"),
  dueDate: date("due_date", { mode: "string" }),
  priority: text("priority").$type<"low" | "medium" | "high">().notNull().default("medium"),
  roiScore: real("roi_score"),
  source: text("source").$type<"manual" | "librus" | "ai" | "plan">().notNull().default("manual"),
  status: text("status").$type<"open" | "done" | "cancelled">().notNull().default("open"),
  estimatedMinutes: integer("estimated_minutes"),
  scheduledFor: date("scheduled_for", { mode: "string" }),
  notes: text("notes"),
  ...syncMeta,
});

export const fileNodes = pgTable("file_nodes", {
  id: text("id").primaryKey(),
  path: text("path").notNull().unique(),
  kind: text("kind").$type<"file" | "directory">().notNull(),
  mimeType: text("mime_type"),
  content: text("content"),
  ...syncMeta,
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<NotificationKind>().notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  chatPrefill: jsonb("chat_prefill").$type<NotificationChatPrefill>(),
  payload: jsonb("payload").$type<NotificationPayload>(),
  planDate: date("plan_date", { mode: "string" }),
  readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
  ...syncMeta,
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  ...syncMeta,
});

export const schema = {
  profile,
  chatThreads,
  chatMessages,
  memoryEntries,
  tasks,
  fileNodes,
  notifications,
  pushSubscriptions,
};

export type ProfileRow = typeof profile.$inferSelect;
export type ChatThreadRow = typeof chatThreads.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type MemoryEntryRow = typeof memoryEntries.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type FileNodeRow = typeof fileNodes.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
