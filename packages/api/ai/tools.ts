import type { MemoryEntry, MemoryKind } from "@chatgpa/core";
import type { ChatAction } from "./actions.ts";
import type { ChatAttachment } from "@chatgpa/core";
import {
  DEFAULT_GROUP_PREFS,
  formatDaySchedule,
  formatTimetableForAi,
  formatWarsawDateTime,
  getCurrentLesson,
  getWarsawNow,
  weekdayFromDate,
  type GroupPrefs,
  type Weekday,
  WEEKDAY_LABELS,
} from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { getDb } from "../db/client.ts";
import { fsList, fsRead, fsWrite } from "../fs/service.ts";
import {
  clearMemory,
  DEFAULT_SHORT_TTL_DAYS,
  forgetMemory,
  listMemory,
  MemoryStore,
  rememberMemory,
} from "../memory/service.ts";
import {
  addTask,
  completeTask,
  deleteTask,
  formatTaskLine,
  listTasks,
  updateTask,
} from "../todo/service.ts";
import { putFile, toAttachment } from "../files/store.ts";
import { normalizeMimeType, sanitizeFilename } from "../files/mime.ts";

export interface ToolResult {
  tool: string;
  ok: boolean;
  output?: string;
  error?: string;
  attachment?: ChatAttachment;
}

export interface ToolRunSummary {
  results: ToolResult[];
  memory: MemoryEntry[];
}

export function formatMemoryEntry(entry: MemoryEntry): string {
  const kindLabel = entry.kind === "short" ? "krótka" : "długa";
  const expiry = entry.expiresAt
    ? `, wygasa: ${new Date(entry.expiresAt).toLocaleString("pl-PL")}`
    : "";
  const tags = entry.tags?.length ? ` [${entry.tags.join(", ")}]` : "";
  return `[${entry.id}] (${kindLabel}${expiry})${tags} ${entry.content}`;
}

export function formatToolResults(results: ToolResult[]): string {
  return results
    .map((r) => {
      if (r.ok) return `[${r.tool}] ${r.output ?? "OK"}`;
      return `[${r.tool}] BŁĄD: ${r.error ?? "nieznany"}`;
    })
    .join("\n");
}

function safeCalc(expression: string): number {
  const cleaned = expression.replace(/[^0-9+\-*/().%\s]/g, "");
  if (!cleaned.trim()) throw new Error("Puste wyrażenie");
  const value = Function(`"use strict"; return (${cleaned})`)();
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Wynik nie jest liczbą");
  }
  return value;
}

const DAY_ALIASES: Record<string, Weekday> = {
  poniedziałek: "mon",
  poniedzialek: "mon",
  pn: "mon",
  mon: "mon",
  monday: "mon",
  wtorek: "tue",
  wt: "tue",
  tue: "tue",
  tuesday: "tue",
  środa: "wed",
  sroda: "wed",
  śr: "wed",
  sr: "wed",
  wed: "wed",
  wednesday: "wed",
  czwartek: "thu",
  czw: "thu",
  thu: "thu",
  thursday: "thu",
  piątek: "fri",
  piatek: "fri",
  pi: "fri",
  fri: "fri",
  friday: "fri",
};

function parseDayArg(raw: unknown): Weekday | null {
  if (typeof raw !== "string") return null;
  return DAY_ALIASES[raw.trim().toLowerCase()] ?? null;
}

function parseKind(raw: unknown): MemoryKind {
  return raw === "short" ? "short" : "long";
}

function parseExpiresInDays(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  return Math.max(1, Math.min(365, Math.round(raw)));
}

function formatCurrentLesson(prefs: GroupPrefs): string {
  const info = getCurrentLesson(prefs);
  const now = getWarsawNow();
  const timeStr = now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

  if (info.status === "weekend") {
    return `Teraz jest ${timeStr} — weekend, brak lekcji.`;
  }

  if (info.status === "during" && info.lesson && info.time) {
    return `Teraz (${timeStr}) trwa lekcja ${info.slot}: ${info.lesson.subject} (${info.lesson.teacher}, sala ${info.lesson.room}), ${info.time.start}–${info.time.end}.`;
  }

  if (info.nextLesson) {
    const dayLabel = WEEKDAY_LABELS[info.nextLesson.day];
    const { lesson, time, slot } = info.nextLesson;
    return `Teraz jest ${timeStr}. Następna lekcja: ${dayLabel}, ${slot}. ${time.start}–${time.end}: ${lesson.subject} (${lesson.teacher}, sala ${lesson.room}).`;
  }

  return `Teraz jest ${timeStr}. Brak kolejnych lekcji w tym tygodniu.`;
}

async function runMemoryAction(
  action: ChatAction,
  store: MemoryStore,
  db: AppDatabase | null,
): Promise<ToolResult> {
  const args = action.args ?? {};

  switch (action.tool) {
    case "memory.remember": {
      const text = typeof args.text === "string" ? args.text : "";
      const content = typeof args.content === "string" ? args.content : text;
      if (!content.trim()) return { tool: action.tool, ok: false, error: "Brak pola text/content" };

      const kind = parseKind(args.kind);
      const expiresInDays = parseExpiresInDays(args.expiresInDays);
      const tags = Array.isArray(args.tags)
        ? args.tags.filter((t): t is string => typeof t === "string")
        : undefined;

      if (db) {
        const entry = await rememberMemory(db, {
          content,
          kind,
          expiresInDays,
          source: "ai",
          tags,
          chatId: typeof args.chatId === "string" ? args.chatId : undefined,
        });
        await store.loadFromDb(db);
        const kindLabel = entry.kind === "short" ? "krótka" : "długa";
        return {
          tool: action.tool,
          ok: true,
          output: `Zapisano w pamięci (${kindLabel}): „${entry.content}” [${entry.id}]`,
        };
      }

      const entry = store.remember({ content, kind, expiresInDays, source: "ai", tags });
      const kindLabel = entry.kind === "short" ? "krótka" : "długa";
      return {
        tool: action.tool,
        ok: true,
        output: `Zapisano w pamięci (${kindLabel}): „${entry.content}” [${entry.id}]`,
      };
    }
    case "memory.list": {
      const kind = typeof args.kind === "string" ? parseKind(args.kind) : undefined;
      const includeExpired = args.includeExpired === true;
      const entries = db
        ? await listMemory(db, { kind, includeExpired })
        : store.list({ kind, includeExpired });

      if (!entries.length) {
        return { tool: action.tool, ok: true, output: "Pamięć jest pusta." };
      }
      return {
        tool: action.tool,
        ok: true,
        output: entries.map((e, i) => `${i + 1}. ${formatMemoryEntry(e)}`).join("\n"),
      };
    }
    case "memory.forget": {
      const id = typeof args.id === "string" ? args.id : undefined;
      const text = typeof args.text === "string" ? args.text : "";
      const content = typeof args.content === "string" ? args.content : text;

      if (!id && !content.trim()) {
        return { tool: action.tool, ok: false, error: "Podaj args.id lub args.text/content" };
      }

      const removed = db
        ? await forgetMemory(db, { id, content: content || undefined })
        : store.forget({ id, content: content || undefined });

      if (!removed) return { tool: action.tool, ok: false, error: "Nie znalazłem tego wpisu" };
      if (db) await store.loadFromDb(db);
      return { tool: action.tool, ok: true, output: `Usunięto: „${removed.content}” [${removed.id}]` };
    }
    case "memory.clear": {
      const kind = typeof args.kind === "string" && args.kind === "long"
        ? "long"
        : typeof args.kind === "string" && args.kind === "all"
        ? "all"
        : "short";

      const cleared = db ? await clearMemory(db, kind) : store.clear(kind);
      if (db) await store.loadFromDb(db);

      const label = kind === "all" ? "całą pamięć" : kind === "long" ? "długą pamięć" : "krótką pamięć";
      return {
        tool: action.tool,
        ok: true,
        output: cleared ? `Wyczyszczono ${label} (${cleared} wpisów).` : `${label} była już pusta.`,
      };
    }
    default:
      return { tool: action.tool, ok: false, error: `Nieznane narzędzie pamięci: ${action.tool}` };
  }
}

async function runTodoAction(
  action: ChatAction,
  db: AppDatabase | null,
): Promise<ToolResult> {
  if (!db) {
    return { tool: action.tool, ok: false, error: "Baza danych nie jest skonfigurowana" };
  }

  const args = action.args ?? {};

  switch (action.tool) {
    case "todo.list": {
      const status = args.status === "open" || args.status === "done" || args.status === "cancelled"
        ? args.status
        : undefined;
      const dueBefore = typeof args.dueBefore === "string" ? args.dueBefore : undefined;
      const items = await listTasks(db, { status, dueBefore });
      if (!items.length) {
        return { tool: action.tool, ok: true, output: "Lista TODO jest pusta." };
      }
      return {
        tool: action.tool,
        ok: true,
        output: items.map((t, i) => formatTaskLine(t, i)).join("\n"),
      };
    }
    case "todo.add": {
      const title = typeof args.title === "string" ? args.title : "";
      if (!title.trim()) return { tool: action.tool, ok: false, error: "Brak pola title" };
      try {
        const task = await addTask(db, {
          title,
          subjectId: typeof args.subjectId === "string" ? args.subjectId : undefined,
          dueDate: typeof args.dueDate === "string" ? args.dueDate : undefined,
          priority: args.priority === "low" || args.priority === "high" ? args.priority : undefined,
          estimatedMinutes: typeof args.estimatedMinutes === "number"
            ? args.estimatedMinutes
            : undefined,
          source: args.source === "librus" || args.source === "ai" || args.source === "plan"
            ? args.source
            : undefined,
          roiScore: typeof args.roiScore === "number" ? args.roiScore : undefined,
        });
        return {
          tool: action.tool,
          ok: true,
          output: `Dodano zadanie: „${task.title}” [${task.id}]`,
        };
      } catch (err) {
        return {
          tool: action.tool,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case "todo.update": {
      const id = typeof args.id === "string" ? args.id : "";
      if (!id.trim()) return { tool: action.tool, ok: false, error: "Brak pola id" };
      const task = await updateTask(db, id, {
        title: typeof args.title === "string" ? args.title : undefined,
        subjectId: args.subjectId === null
          ? null
          : typeof args.subjectId === "string"
          ? args.subjectId
          : undefined,
        dueDate: args.dueDate === null
          ? null
          : typeof args.dueDate === "string"
          ? args.dueDate
          : undefined,
        priority: args.priority === "low" || args.priority === "medium" || args.priority === "high"
          ? args.priority
          : undefined,
        status: args.status === "open" || args.status === "done" || args.status === "cancelled"
          ? args.status
          : undefined,
        estimatedMinutes: typeof args.estimatedMinutes === "number" ? args.estimatedMinutes : undefined,
        source: args.source === "manual" || args.source === "librus" || args.source === "ai" ||
            args.source === "plan"
          ? args.source
          : undefined,
        roiScore: typeof args.roiScore === "number" ? args.roiScore : undefined,
      });
      if (!task) return { tool: action.tool, ok: false, error: "Nie znaleziono zadania" };
      return {
        tool: action.tool,
        ok: true,
        output: `Zaktualizowano: „${task.title}” [${task.id}]`,
      };
    }
    case "todo.complete": {
      const id = typeof args.id === "string" ? args.id : "";
      if (!id.trim()) return { tool: action.tool, ok: false, error: "Brak pola id" };
      const task = await completeTask(db, id);
      if (!task) return { tool: action.tool, ok: false, error: "Nie znaleziono zadania" };
      return {
        tool: action.tool,
        ok: true,
        output: `Oznaczono jako zrobione: „${task.title}” [${task.id}]`,
      };
    }
    case "todo.delete": {
      const id = typeof args.id === "string" ? args.id : "";
      if (!id.trim()) return { tool: action.tool, ok: false, error: "Brak pola id" };
      const task = await deleteTask(db, id);
      if (!task) return { tool: action.tool, ok: false, error: "Nie znaleziono zadania" };
      return {
        tool: action.tool,
        ok: true,
        output: `Usunięto: „${task.title}” [${task.id}]`,
      };
    }
    default:
      return { tool: action.tool, ok: false, error: `Nieznane narzędzie TODO: ${action.tool}` };
  }
}

async function runOne(
  action: ChatAction,
  store: MemoryStore,
  groupPrefs: GroupPrefs,
): Promise<ToolResult> {
  const args = action.args ?? {};
  const db = getDb();

  if (action.tool.startsWith("memory.")) {
    return await runMemoryAction(action, store, db);
  }

  if (action.tool.startsWith("todo.")) {
    return await runTodoAction(action, db);
  }

  switch (action.tool) {
    case "datetime.now": {
      return { tool: action.tool, ok: true, output: formatWarsawDateTime() };
    }
    case "calc.eval": {
      const expression = typeof args.expression === "string" ? args.expression : "";
      if (!expression.trim()) return { tool: action.tool, ok: false, error: "Brak expression" };
      try {
        const value = safeCalc(expression);
        return { tool: action.tool, ok: true, output: String(value) };
      } catch (err) {
        return {
          tool: action.tool,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case "file.send": {
      const rawName = typeof args.name === "string" ? args.name.trim() : "plik.txt";
      const content = typeof args.content === "string" ? args.content : "";
      const mimeArg = typeof args.mimeType === "string" ? args.mimeType : "text/plain";
      if (!content.trim()) return { tool: action.tool, ok: false, error: "Brak pola content" };
      try {
        const name = sanitizeFilename(rawName);
        const mimeType = normalizeMimeType(mimeArg, name);
        const stored = await putFile({
          name,
          mimeType,
          bytes: new TextEncoder().encode(content),
        });
        const attachment = toAttachment(stored);
        const url = `/api/files/${stored.id}`;
        return {
          tool: action.tool,
          ok: true,
          output: `Plik gotowy: ${url}`,
          attachment,
        };
      } catch (err) {
        return {
          tool: action.tool,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case "timetable.today": {
      const day = weekdayFromDate(getWarsawNow());
      if (!day) {
        return { tool: action.tool, ok: true, output: "Dziś weekend — brak lekcji." };
      }
      return { tool: action.tool, ok: true, output: formatDaySchedule(day, groupPrefs) };
    }
    case "timetable.now": {
      return { tool: action.tool, ok: true, output: formatCurrentLesson(groupPrefs) };
    }
    case "timetable.day": {
      const day = parseDayArg(args.day);
      if (!day) {
        return {
          tool: action.tool,
          ok: false,
          error: "Podaj args.day: poniedziałek, wtorek, środa, czwartek lub piątek",
        };
      }
      return { tool: action.tool, ok: true, output: formatDaySchedule(day, groupPrefs) };
    }
    case "timetable.full": {
      return { tool: action.tool, ok: true, output: formatTimetableForAi(groupPrefs) };
    }
    case "fs.list": {
      if (!db) {
        return { tool: action.tool, ok: false, error: "Baza danych nie jest skonfigurowana" };
      }
      const path = typeof args.path === "string" ? args.path : "~";
      try {
        const result = await fsList(db, path);
        if (result.entries.length === 0) {
          return { tool: action.tool, ok: true, output: `${result.path}: (pusty katalog)` };
        }
        const lines = result.entries.map((e) =>
          `${e.kind === "directory" ? "[dir]" : "[file]"} ${e.name} (${e.path})`
        );
        return { tool: action.tool, ok: true, output: `${result.path}:\n${lines.join("\n")}` };
      } catch (err) {
        return {
          tool: action.tool,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case "fs.read": {
      if (!db) {
        return { tool: action.tool, ok: false, error: "Baza danych nie jest skonfigurowana" };
      }
      const path = typeof args.path === "string" ? args.path : "";
      if (!path.trim()) return { tool: action.tool, ok: false, error: "Brak pola path" };
      const offset = typeof args.offset === "number" ? args.offset : 0;
      const limit = typeof args.limit === "number" ? args.limit : 500;
      try {
        const result = await fsRead(db, path, offset, limit);
        const header = result.totalLines > offset + limit
          ? `(linie ${offset + 1}–${Math.min(offset + limit, result.totalLines)} z ${result.totalLines})\n`
          : "";
        return {
          tool: action.tool,
          ok: true,
          output: `${result.path}:\n${header}${result.content}`,
        };
      } catch (err) {
        return {
          tool: action.tool,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case "fs.write": {
      if (!db) {
        return { tool: action.tool, ok: false, error: "Baza danych nie jest skonfigurowana" };
      }
      const path = typeof args.path === "string" ? args.path : "";
      const content = typeof args.content === "string" ? args.content : "";
      if (!path.trim()) return { tool: action.tool, ok: false, error: "Brak pola path" };
      if (!content) return { tool: action.tool, ok: false, error: "Brak pola content" };
      const createOnly = args.createOnly === true;
      try {
        const result = await fsWrite(db, path, content, createOnly);
        return {
          tool: action.tool,
          ok: true,
          output: result.created ? `Utworzono ${result.path}` : `Zaktualizowano ${result.path}`,
        };
      } catch (err) {
        return {
          tool: action.tool,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    default:
      return { tool: action.tool, ok: false, error: `Nieznane narzędzie: ${action.tool}` };
  }
}

export async function createMemoryStore(legacyFacts?: string[]): Promise<MemoryStore> {
  const db = getDb();
  if (db) {
    const store = new MemoryStore();
    await store.loadFromDb(db);
    return store;
  }
  return MemoryStore.fromLegacyStrings(legacyFacts ?? []);
}

export async function executeActions(
  actions: ChatAction[],
  store: MemoryStore,
  groupPrefs: GroupPrefs = DEFAULT_GROUP_PREFS,
): Promise<ToolRunSummary> {
  const results: ToolResult[] = [];
  for (const action of actions) {
    results.push(await runOne(action, store, groupPrefs));
  }

  const db = getDb();
  if (db && store.isDirty()) {
    await store.saveToDb(db);
    await store.loadFromDb(db);
  }

  return { results, memory: store.list() };
}

export { DEFAULT_SHORT_TTL_DAYS };
