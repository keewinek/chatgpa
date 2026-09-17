/**
 * MCP server exposing ChatGPA's virtual FS (Postgres `file_nodes`) AND its domain services
 * (todo, calendar, timetable, grades, memory) to Claude Code as live tools. Same DB, same data
 * the running app and the in-app agent see.
 *
 * The fs_* tools are the general-purpose escape hatch (any path under ~/). The domain tools
 * below wrap the same service functions the app itself uses (todo/service.ts,
 * calendar/service.ts, memory/service.ts) — prefer them over hand-editing files: they validate
 * input (e.g. a calendar event's `kind`) and can't produce a malformed file the way a raw
 * fs_write can.
 *
 * Registered for this repo in `.mcp.json`. Run standalone with `deno task mcp`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadEnv } from "../env.ts";
import { closeDb, getDb } from "../db/client.ts";
import type { AppDatabase } from "../db/client.ts";
import { fsDelete, FsError, fsGrep, fsList, fsMkdir, fsRead, fsWrite } from "../fs/service.ts";
import { addTask, completeTask, deleteTask, listTasks, updateTask } from "../todo/service.ts";
import { addEvent, deleteEvent, listEvents, updateEvent } from "../calendar/service.ts";
import { listMemory, rememberMemory } from "../memory/service.ts";
import { loadStoredGroupPrefs } from "../fs/groups.ts";
import {
  DEFAULT_GROUP_PREFS,
  formatDaySchedule,
  formatTimetableForAi,
  getCurrentLesson,
  getWarsawNow,
  weekdayFromDate,
  WEEKDAY_LABELS,
} from "@chatgpa/core";

await loadEnv();
const maybeDb = getDb();
if (!maybeDb) {
  console.error("Brak DATABASE_URL — ustaw w .env żeby uruchomić packages/api/mcp/server.ts");
  Deno.exit(1);
}
const db: AppDatabase = maybeDb;

const server = new McpServer({ name: "chatgpa-fs", version: "0.2.0" });

function text(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }],
  };
}

function asError(err: unknown) {
  const message = err instanceof FsError
    ? err.message
    : err instanceof Error
    ? err.message
    : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function groupPrefs() {
  return (await loadStoredGroupPrefs(db)) ?? DEFAULT_GROUP_PREFS;
}

function formatCurrentLesson(info: ReturnType<typeof getCurrentLesson>): string {
  const now = getWarsawNow();
  const timeStr = now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

  if (info.status === "weekend") return `Teraz jest ${timeStr} — weekend, brak lekcji.`;
  if (info.status === "during" && info.lesson && info.time) {
    return `Teraz (${timeStr}) trwa lekcja ${info.slot}: ${info.lesson.subject} ` +
      `(${info.lesson.teacher}, sala ${info.lesson.room}), ${info.time.start}–${info.time.end}.`;
  }
  if (info.nextLesson) {
    const dayLabel = WEEKDAY_LABELS[info.nextLesson.day];
    const { lesson, time, slot } = info.nextLesson;
    return `Teraz jest ${timeStr}. Następna lekcja: ${dayLabel}, ${slot}. ${time.start}–${time.end}: ` +
      `${lesson.subject} (${lesson.teacher}, sala ${lesson.room}).`;
  }
  return `Teraz jest ${timeStr}. Brak kolejnych lekcji w tym tygodniu.`;
}

/* ---------- Virtual filesystem (general-purpose) ---------- */

server.registerTool(
  "fs_list",
  {
    title: "List ChatGPA directory",
    description:
      "List a directory under ChatGPA's virtual ~/ filesystem (todo, notes, calendar, memory, plans, dev/…).",
    inputSchema: { path: z.string().default("~").describe('Virtual path, e.g. "~" or "~/todo"') },
  },
  async ({ path }) => {
    try {
      return text(await fsList(db, path));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_read",
  {
    title: "Read ChatGPA file",
    description: "Read a file's content from ChatGPA's virtual ~/ filesystem.",
    inputSchema: {
      path: z.string().describe('Virtual path, e.g. "~/todo/global.todo"'),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(2000).optional(),
    },
  },
  async ({ path, offset, limit }) => {
    try {
      return text(await fsRead(db, path, offset ?? 0, limit ?? 500));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_grep",
  {
    title: "Search ChatGPA files",
    description: "Full-text search across ChatGPA's virtual ~/ filesystem.",
    inputSchema: {
      query: z.string(),
      path: z.string().optional().describe("Scope search to this virtual path (default: ~)"),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  async ({ query, path, limit }) => {
    try {
      return text(await fsGrep(db, query, { path, limit }));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_write",
  {
    title: "Write ChatGPA file",
    description:
      "Create or overwrite a file in ChatGPA's virtual ~/ filesystem. Always fs_read first when " +
      "appending — this replaces the whole file content. For a TODO item or calendar event, " +
      "prefer todo_add/calendar_add instead — they validate fields and can't corrupt the file " +
      "the way a hand-written fs_write can.",
    inputSchema: {
      path: z.string(),
      content: z.string(),
      createOnly: z.boolean().optional().describe("Fail instead of overwriting if the file exists"),
    },
  },
  async ({ path, content, createOnly }) => {
    try {
      return text(await fsWrite(db, path, content, createOnly ?? false));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_mkdir",
  {
    title: "Create ChatGPA directory",
    description: "Create a directory in ChatGPA's virtual ~/ filesystem.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    try {
      return text(await fsMkdir(db, path));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_delete",
  {
    title: "Delete ChatGPA file",
    description: "Delete a file or empty directory in ChatGPA's virtual ~/ filesystem.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    try {
      return text(await fsDelete(db, path));
    } catch (err) {
      return asError(err);
    }
  },
);

/* ---------- TODO ---------- */

server.registerTool(
  "todo_list",
  {
    title: "List tasks",
    description: "List the student's TODO items, optionally filtered by status or date.",
    inputSchema: {
      status: z.enum(["open", "done", "cancelled"]).optional(),
      dueBefore: z.string().optional().describe("YYYY-MM-DD"),
      scheduledFor: z.string().optional().describe("YYYY-MM-DD"),
    },
  },
  async ({ status, dueBefore, scheduledFor }) => {
    try {
      return text(await listTasks(db, { status, dueBefore, scheduledFor }));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "todo_add",
  {
    title: "Add task",
    description:
      "Add a task to the student's TODO list. Use this whenever a real assignment or deadline " +
      "comes up in conversation — don't let it evaporate.",
    inputSchema: {
      title: z.string(),
      dueDate: z.string().optional().describe("YYYY-MM-DD"),
      subjectId: z.string().optional().describe("e.g. \"polski\", \"matematyka\""),
      priority: z.enum(["low", "medium", "high"]).optional(),
      estimatedMinutes: z.number().int().positive().optional(),
      scheduledFor: z.string().optional().describe("YYYY-MM-DD — when to actually work on it"),
      notes: z.string().optional(),
    },
  },
  async (args) => {
    try {
      return text(await addTask(db, { ...args, source: "ai" }));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "todo_update",
  {
    title: "Update task",
    description: "Update fields on an existing task (title, due date, priority, status, notes…).",
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      dueDate: z.string().optional().describe("YYYY-MM-DD"),
      priority: z.enum(["low", "medium", "high"]).optional(),
      status: z.enum(["open", "done", "cancelled"]).optional(),
      estimatedMinutes: z.number().int().positive().optional(),
      scheduledFor: z.string().optional().describe("YYYY-MM-DD"),
      notes: z.string().optional(),
    },
  },
  async ({ id, ...patch }) => {
    try {
      const task = await updateTask(db, id, patch);
      if (!task) return asError(new Error("Nie znaleziono zadania"));
      return text(task);
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "todo_complete",
  {
    title: "Complete task",
    description: "Mark a task as done.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    try {
      const task = await completeTask(db, id);
      if (!task) return asError(new Error("Nie znaleziono zadania"));
      return text(task);
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "todo_delete",
  {
    title: "Delete task",
    description: "Remove a task entirely (not the same as marking it done).",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    try {
      const task = await deleteTask(db, id);
      if (!task) return asError(new Error("Nie znaleziono zadania"));
      return text(task);
    } catch (err) {
      return asError(err);
    }
  },
);

/* ---------- Calendar ---------- */

const EVENT_KIND = z.enum(["exam", "homework", "study_block", "personal"]);

server.registerTool(
  "calendar_list",
  {
    title: "List calendar events",
    description: "List calendar events (exams, homework, study blocks, personal), optionally in a date range.",
    inputSchema: {
      from: z.string().optional().describe("YYYY-MM-DD"),
      to: z.string().optional().describe("YYYY-MM-DD"),
    },
  },
  async ({ from, to }) => {
    try {
      return text(await listEvents(db, from, to));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "calendar_add",
  {
    title: "Add calendar event",
    description:
      "Add an event to the student's calendar. Use kind \"homework\" for assignments with a " +
      "due date, \"exam\" for tests, \"study_block\" for a planned study session, \"personal\" " +
      "for anything else. `kind` must be one of these four — there is no \"deadline\" kind.",
    inputSchema: {
      title: z.string(),
      kind: EVENT_KIND,
      start: z.string().describe("ISO datetime with offset, e.g. 2026-09-21T08:00:00+02:00"),
      end: z.string().optional(),
      subject: z.string().optional(),
    },
  },
  async ({ title, kind, start, end, subject }) => {
    try {
      return text(await addEvent(db, { title, kind, start, end, subject, source: "ai" }));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "calendar_update",
  {
    title: "Update calendar event",
    description: "Update fields on an existing calendar event.",
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      kind: EVENT_KIND.optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      subject: z.string().optional(),
    },
  },
  async ({ id, ...patch }) => {
    try {
      const updated = await updateEvent(db, id, patch);
      if (!updated) return asError(new Error("Wydarzenie nie znalezione"));
      return text(updated);
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "calendar_delete",
  {
    title: "Delete calendar event",
    description: "Remove a calendar event.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    try {
      const ok = await deleteEvent(db, id);
      if (!ok) return asError(new Error("Wydarzenie nie znalezione"));
      return text({ ok: true });
    } catch (err) {
      return asError(err);
    }
  },
);

/* ---------- Timetable ---------- */

server.registerTool(
  "timetable_now",
  {
    title: "Current lesson",
    description:
      "What lesson the student is in right now (or the next one). Call this early in any " +
      "school-related conversation — you should always know their schedule, not just when asked.",
    inputSchema: {},
  },
  async () => {
    try {
      return text(formatCurrentLesson(getCurrentLesson(await groupPrefs())));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "timetable_today",
  {
    title: "Today's schedule",
    description: "The student's full lesson schedule for today (or tomorrow's if asked to plan ahead).",
    inputSchema: {},
  },
  async () => {
    try {
      const day = weekdayFromDate(getWarsawNow());
      if (!day) return text("Dziś weekend — brak lekcji.");
      return text(formatDaySchedule(day, await groupPrefs()));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "timetable_full",
  {
    title: "Full weekly timetable",
    description: "The student's whole Monday–Friday lesson schedule.",
    inputSchema: {},
  },
  async () => {
    try {
      return text(formatTimetableForAi(await groupPrefs()));
    } catch (err) {
      return asError(err);
    }
  },
);

/* ---------- Grades ---------- */

server.registerTool(
  "grades_get",
  {
    title: "Get grades snapshot",
    description:
      "The student's Librus grades snapshot (subjects, individual grades, averages). Returns an " +
      "error if never synced — never guess grades, tell the student to sync Librus instead.",
    inputSchema: {},
  },
  async () => {
    try {
      return text((await fsRead(db, "~/school/librus/grades.json", 0, 2000)).content);
    } catch (err) {
      if (err instanceof FsError && err.status === 404) {
        return text("Brak synchronizacji Librus — plik ~/school/librus/grades.json nie istnieje.");
      }
      return asError(err);
    }
  },
);

/* ---------- Memory ---------- */

server.registerTool(
  "memory_list",
  {
    title: "List remembered facts",
    description: "List durable facts remembered about the student (preferences, goals, constraints…).",
    inputSchema: {
      kind: z.enum(["short", "long"]).optional(),
      includeExpired: z.boolean().optional(),
    },
  },
  async ({ kind, includeExpired }) => {
    try {
      return text(await listMemory(db, { kind, includeExpired }));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "memory_remember",
  {
    title: "Remember a fact",
    description:
      "Save a durable fact about the student (preferences, class, goals, recurring constraints) " +
      "so future sessions know it without being told again.",
    inputSchema: {
      content: z.string(),
      kind: z.enum(["short", "long"]).optional().describe('"long" for durable facts, "short" for temporary ones (default "long")'),
      expiresInDays: z.number().int().min(1).max(365).optional().describe("Only for kind=short"),
      tags: z.array(z.string()).optional(),
    },
  },
  async ({ content, kind, expiresInDays, tags }) => {
    try {
      return text(
        await rememberMemory(db, { content, kind: kind ?? "long", expiresInDays, source: "ai", tags }),
      );
    } catch (err) {
      return asError(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

globalThis.addEventListener("unload", () => {
  closeDb();
});
