import { DEFAULT_GROUP_PREFS, type GroupPrefs } from "@chatgpa/core";
import type { AppDatabase } from "../db/client.ts";
import { sanitizeGroupPrefs } from "../validate.ts";
import { fsRead, fsWrite } from "./service.ts";

export const GROUPS_PATH = "~/school/groups.json";

export { sanitizeGroupPrefs };

export function formatGroupsSummary(prefs: GroupPrefs): string {
  return [
    `język obcy: ${prefs.language === 1 ? "hiszpański (1)" : "niemiecki (2)"}`,
    `angielski: grupa ${prefs.english}`,
    `WF: grupa ${prefs.pe}`,
    `informatyka: grupa ${prefs.informatics}`,
  ].join(", ");
}

export async function loadStoredGroupPrefs(db: AppDatabase): Promise<GroupPrefs | null> {
  try {
    const file = await fsRead(db, GROUPS_PATH, 0, 50);
    return sanitizeGroupPrefs(JSON.parse(file.content));
  } catch {
    return null;
  }
}

export async function saveStoredGroupPrefs(
  db: AppDatabase,
  prefs: GroupPrefs,
): Promise<void> {
  const content = JSON.stringify(prefs, null, 2) + "\n";
  await fsWrite(db, GROUPS_PATH, content);
}

export async function resolveGroupPrefs(
  db: AppDatabase | null,
  fallback: GroupPrefs = DEFAULT_GROUP_PREFS,
): Promise<GroupPrefs> {
  if (!db) return { ...fallback };
  const stored = await loadStoredGroupPrefs(db);
  return stored ?? { ...fallback };
}
