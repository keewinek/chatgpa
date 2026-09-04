/** Views opened from virtual `.ui` files or slash commands. */
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

/** Only calendar + timetable ship as `.ui` launchers (Cursor-style: rest is plain files). */
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
] as const;

/** Targets for slash/panel open — data path, not necessarily a .ui file. */
export const PANEL_TARGETS: Record<
  UiView,
  { path: string; title: string; icon: string }
> = {
  calendar: { path: "~/calendar/calendar.ui", title: "Kalendarz", icon: "calendar" },
  timetable: { path: "~/school/timetable.ui", title: "Plan lekcji", icon: "table-columns" },
  todo: { path: "~/todo/global.todo", title: "TODO", icon: "list-check" },
  notes: { path: "~/notes", title: "Notatki", icon: "note-sticky" },
  profile: { path: "~/profile/me.profile", title: "Profil czasu", icon: "user-clock" },
  pomodoro: { path: "~/pomodoro", title: "Pomodoro", icon: "stopwatch" },
};

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
      if (parsed.view === "calendar" || parsed.view === "timetable") {
        const target = PANEL_TARGETS[parsed.view];
        return {
          view: parsed.view,
          title: parsed.title ?? target.title,
        };
      }
      // Obsolete .ui (todo/notes/…) — treat as plain file, no panel.
      return null;
    } catch {
      /* fall through */
    }
  }

  const stem = base.slice(0, -3).toLowerCase();
  if (stem === "calendar" || stem === "kalendarz") {
    return { view: "calendar", title: PANEL_TARGETS.calendar.title };
  }
  if (stem === "timetable" || stem === "plan" || stem === "plan-lekcji") {
    return { view: "timetable", title: PANEL_TARGETS.timetable.title };
  }
  return null;
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
