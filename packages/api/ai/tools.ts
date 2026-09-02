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
  memory: string[];
}

export function buildMemoryBlock(memory: string[]): string {
  if (memory.length === 0) return "";
  const lines = memory.map((fact) => `- ${fact}`).join("\n");
  return `Pamięć ucznia (zapisane fakty — traktuj jako prawdę, nie wymyślaj poza tym):\n${lines}`;
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

async function runOne(
  action: ChatAction,
  memory: string[],
  groupPrefs: GroupPrefs,
): Promise<ToolResult> {
  const args = action.args ?? {};
  switch (action.tool) {
    case "memory.remember": {
      const text = typeof args.text === "string" ? args.text.trim() : "";
      if (!text) return { tool: action.tool, ok: false, error: "Brak pola text" };
      if (memory.some((m) => m.toLowerCase() === text.toLowerCase())) {
        return { tool: action.tool, ok: true, output: "Fakt już jest w pamięci." };
      }
      memory.push(text);
      return { tool: action.tool, ok: true, output: `Zapisano: „${text}”` };
    }
    case "memory.list": {
      if (memory.length === 0) {
        return { tool: action.tool, ok: true, output: "Pamięć jest pusta." };
      }
      return {
        tool: action.tool,
        ok: true,
        output: memory.map((m, i) => `${i + 1}. ${m}`).join("\n"),
      };
    }
    case "memory.forget": {
      const text = typeof args.text === "string" ? args.text.trim().toLowerCase() : "";
      const idx = memory.findIndex((m) => m.toLowerCase() === text);
      if (idx === -1) return { tool: action.tool, ok: false, error: "Nie znalazłem tego faktu" };
      const removed = memory.splice(idx, 1)[0];
      return { tool: action.tool, ok: true, output: `Usunięto: „${removed}”` };
    }
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
    default:
      return { tool: action.tool, ok: false, error: `Nieznane narzędzie: ${action.tool}` };
  }
}

export async function executeActions(
  actions: ChatAction[],
  memory: string[],
  groupPrefs: GroupPrefs = DEFAULT_GROUP_PREFS,
): Promise<ToolRunSummary> {
  const results: ToolResult[] = [];
  for (const action of actions) {
    results.push(await runOne(action, memory, groupPrefs));
  }
  return { results, memory };
}
