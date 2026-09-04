import { DEFAULT_GROUP_PREFS, type GroupPrefs } from "@chatgpa/core";
import { fsRead, fsWrite } from "./fs-api.ts";

const PREFS_KEY = "chatgpa:timetable:groups";
const GROUPS_PATH = "~/school/groups.json";

function sanitize(prefs: Partial<GroupPrefs> | null | undefined): GroupPrefs {
  return {
    language: prefs?.language === 2 ? 2 : 1,
    english: prefs?.english === 2 ? 2 : 1,
    pe: prefs?.pe === 2 ? 2 : 1,
    informatics: prefs?.informatics === 2 ? 2 : 1,
  };
}

/** Sync fallback for chat requests before async hydrate finishes. */
export function loadGroupPrefs(): GroupPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_GROUP_PREFS };
    return sanitize(JSON.parse(raw) as Partial<GroupPrefs>);
  } catch {
    return { ...DEFAULT_GROUP_PREFS };
  }
}

export function saveGroupPrefsLocal(prefs: GroupPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** Source of truth: ~/school/groups.json (also writable by the agent). */
export async function loadGroupPrefsAsync(): Promise<GroupPrefs> {
  try {
    const file = await fsRead(GROUPS_PATH);
    const prefs = sanitize(JSON.parse(file.content) as Partial<GroupPrefs>);
    saveGroupPrefsLocal(prefs);
    return prefs;
  } catch {
    return loadGroupPrefs();
  }
}

export async function saveGroupPrefs(prefs: GroupPrefs): Promise<void> {
  saveGroupPrefsLocal(prefs);
  try {
    await fsWrite(GROUPS_PATH, JSON.stringify(prefs, null, 2) + "\n");
  } catch {
    /* local cache still updated */
  }
}
