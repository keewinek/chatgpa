/** Views opened from virtual `.ui` files in the same tree as everything else. */
export type UiView =
  | "calendar"
  | "timetable"
  | "todo"
  | "notes"
  | "profile"
  | "pomodoro";

export type UiShortcutDef = {
  /** Folder under ~/ that also holds the related data files. */
  dir: string;
  /** Filename ending in .ui */
  file: string;
  view: UiView;
  title: string;
  /** Font Awesome icon name (fa-solid). */
  icon: string;
};

/** `.ui` files live in the same folders as related content under ~/. */
export const UI_SHORTCUTS: readonly UiShortcutDef[] = [
  {
    dir: "calendar",
    file: "calendar.ui",
    view: "calendar",
    title: "Kalendarz",
    icon: "calendar",
  },
  {
    dir: "school",
    file: "timetable.ui",
    view: "timetable",
    title: "Plan lekcji",
    icon: "table-columns",
  },
  { dir: "todo", file: "todo.ui", view: "todo", title: "TODO", icon: "list-check" },
  { dir: "notes", file: "notes.ui", view: "notes", title: "Notatki", icon: "note-sticky" },
  {
    dir: "profile",
    file: "profile.ui",
    view: "profile",
    title: "Profil czasu",
    icon: "user-clock",
  },
  {
    dir: "pomodoro",
    file: "pomodoro.ui",
    view: "pomodoro",
    title: "Pomodoro",
    icon: "stopwatch",
  },
] as const;

export function uiShortcutPath(def: UiShortcutDef): string {
  return `~/${def.dir}/${def.file}`;
}

export function uiShortcutContent(def: UiShortcutDef): string {
  return JSON.stringify({ view: def.view, title: def.title }, null, 2) + "\n";
}

export function isUiShortcut(name: string): boolean {
  return name.toLowerCase().endsWith(".ui");
}

/** Resolve view from filename or .ui file JSON content. */
export function parseUiShortcut(
  pathOrName: string,
  content?: string,
): { view: UiView; title: string } | null {
  const base = pathOrName.split("/").pop() ?? pathOrName;
  if (!isUiShortcut(base)) return null;

  if (content) {
    try {
      const parsed = JSON.parse(content) as { view?: string; title?: string };
      if (
        parsed.view === "calendar" || parsed.view === "timetable" ||
        parsed.view === "todo" || parsed.view === "notes" ||
        parsed.view === "profile" || parsed.view === "pomodoro"
      ) {
        const def = UI_SHORTCUTS.find((s) => s.view === parsed.view);
        return {
          view: parsed.view,
          title: parsed.title ?? def?.title ?? parsed.view,
        };
      }
    } catch {
      /* fall through to filename */
    }
  }

  const stem = base.slice(0, -3).toLowerCase();
  const byFile: Record<string, UiView> = {
    calendar: "calendar",
    kalendarz: "calendar",
    timetable: "timetable",
    plan: "timetable",
    "plan-lekcji": "timetable",
    todo: "todo",
    notes: "notes",
    notatki: "notes",
    profile: "profile",
    profil: "profile",
    pomodoro: "pomodoro",
  };
  const view = byFile[stem];
  if (!view) return null;
  const def = UI_SHORTCUTS.find((s) => s.view === view);
  return { view, title: def?.title ?? view };
}

export function viewFromSlash(command: string): UiView | null {
  const map: Record<string, UiView> = {
    calendar: "calendar",
    timetable: "timetable",
    todo: "todo",
    notes: "notes",
    profile: "profile",
    pomodoro: "pomodoro",
  };
  return map[command] ?? null;
}
