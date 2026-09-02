import { PLAN_TODAY_SEED, PLAN_WEEK_SEED } from "./command-seeds.ts";

export type UiCommand = "pomodoro" | "todo" | "notes" | "files";

export type ParsedCommand =
  | { type: "ui"; command: UiCommand; notesPath?: string | null }
  | { type: "api"; command: "clear-short-memory"; confirmMessage: string }
  | { type: "prompt"; seed: string; display: string };

export interface CommandEntry {
  id: string;
  trigger: string;
  description: string;
  category: "ui" | "api" | "prompt";
}

export const COMMAND_REGISTRY: CommandEntry[] = [
  {
    id: "plan",
    trigger: "/plan",
    description: "Plan na dziś — seed prompt do AI",
    category: "prompt",
  },
  {
    id: "plan-week",
    trigger: "/plan tydzień",
    description: "Plan tygodnia z nauką przed sprawdzianami",
    category: "prompt",
  },
  {
    id: "clear-short-memory",
    trigger: "/clear short memory",
    description: "Wyczyść krótką pamięć agenta",
    category: "api",
  },
  {
    id: "pomodoro",
    trigger: "/pomodoro",
    description: "Otwórz timer Pomodoro (25/5)",
    category: "ui",
  },
  {
    id: "todo",
    trigger: "/todo",
    description: "Otwórz globalną listę TODO",
    category: "ui",
  },
  {
    id: "notes",
    trigger: "/notes",
    description: "Otwórz przeglądarkę notatek",
    category: "ui",
  },
  {
    id: "files",
    trigger: "/files",
    description: "Otwórz system plików",
    category: "ui",
  },
];

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function parseNotesArgs(rest: string): string | null {
  const openMatch = rest.match(/^(?:otwórz|otworz|open)\s+(.+)$/i);
  return openMatch?.[1]?.trim() ?? null;
}

/** Parsuje wiadomość zaczynającą się od `/`. Nieznana komenda → null (zwykła wiadomość). */
export function parseSlashCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const lower = normalize(trimmed);

  if (lower === "/clear short memory" || lower.startsWith("/clear short memory ")) {
    return {
      type: "api",
      command: "clear-short-memory",
      confirmMessage: "Wyczyszczono krótką pamięć.",
    };
  }

  if (
    lower === "/plan tydzień" ||
    lower === "/plan tydzien" ||
    lower.startsWith("/plan tydzień ") ||
    lower.startsWith("/plan tydzien ")
  ) {
    return { type: "prompt", seed: PLAN_WEEK_SEED, display: "/plan tydzień" };
  }

  if (lower.startsWith("/plan")) {
    const rest = trimmed.slice("/plan".length).trim().toLowerCase();
    if (rest.startsWith("tydzień") || rest.startsWith("tydzien")) {
      return { type: "prompt", seed: PLAN_WEEK_SEED, display: "/plan tydzień" };
    }
    if (!rest || rest === "dziś" || rest === "dzis" || rest === "dzisiaj") {
      return { type: "prompt", seed: PLAN_TODAY_SEED, display: "/plan" };
    }
    return null;
  }

  if (lower === "/pomodoro" || lower.startsWith("/pomodoro ")) {
    return { type: "ui", command: "pomodoro" };
  }

  if (lower === "/todo" || lower.startsWith("/todo ")) {
    return { type: "ui", command: "todo" };
  }

  if (lower.startsWith("/notes")) {
    const rest = trimmed.slice("/notes".length).trim();
    return { type: "ui", command: "notes", notesPath: parseNotesArgs(rest) };
  }

  if (lower === "/files" || lower.startsWith("/files ")) {
    return { type: "ui", command: "files" };
  }

  return null;
}

/** Filtruje komendy do autocomplete — query musi zaczynać się od `/`. */
export function filterCommands(query: string): CommandEntry[] {
  if (!query.startsWith("/")) return [];

  const q = query.toLowerCase();
  return COMMAND_REGISTRY.filter((entry) => entry.trigger.toLowerCase().startsWith(q));
}
