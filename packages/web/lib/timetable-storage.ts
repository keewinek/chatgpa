import { DEFAULT_GROUP_PREFS, type GroupPrefs } from "@chatgpa/core";

const PREFS_KEY = "chatgpa:timetable:groups";

export function loadGroupPrefs(): GroupPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_GROUP_PREFS };
    const parsed = JSON.parse(raw) as Partial<GroupPrefs>;
    return {
      language: parsed.language === 2 ? 2 : 1,
      english: parsed.english === 2 ? 2 : 1,
      pe: parsed.pe === 2 ? 2 : 1,
      informatics: parsed.informatics === 2 ? 2 : 1,
    };
  } catch {
    return { ...DEFAULT_GROUP_PREFS };
  }
}

export function saveGroupPrefs(prefs: GroupPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
