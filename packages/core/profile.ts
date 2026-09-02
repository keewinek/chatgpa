export interface TimeProfile {
  commuteAfterSchoolMinutes: number;
  commuteExtraMinutes: number;
  studyEndPreferred: string;
  studyEndHard: string;
  showerAndBreakMinutes: number;
  notificationAfterSchoolMinutes: number;
}

export const DEFAULT_TIME_PROFILE: TimeProfile = {
  commuteAfterSchoolMinutes: 60,
  commuteExtraMinutes: 30,
  studyEndPreferred: "21:00",
  studyEndHard: "21:30",
  showerAndBreakMinutes: 30,
  notificationAfterSchoolMinutes: 30,
};

export function serializeProfile(profile: TimeProfile): string {
  const lines = [
    "# Profil czasowy ucznia",
    `commuteAfterSchoolMinutes: ${profile.commuteAfterSchoolMinutes}`,
    `commuteExtraMinutes: ${profile.commuteExtraMinutes}`,
    `studyEndPreferred: "${profile.studyEndPreferred}"`,
    `studyEndHard: "${profile.studyEndHard}"`,
    `showerAndBreakMinutes: ${profile.showerAndBreakMinutes}`,
    `notificationAfterSchoolMinutes: ${profile.notificationAfterSchoolMinutes}`,
  ];
  return lines.join("\n") + "\n";
}

export function parseProfile(content: string): TimeProfile {
  const result = { ...DEFAULT_TIME_PROFILE };
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(\w+):\s*(.+)$/);
    if (!match) continue;
    const [, key, raw] = match;
    const value = raw.replace(/^["']|["']$/g, "").trim();
    switch (key) {
      case "commuteAfterSchoolMinutes":
        result.commuteAfterSchoolMinutes = Number(value) || result.commuteAfterSchoolMinutes;
        break;
      case "commuteExtraMinutes":
        result.commuteExtraMinutes = Number(value) || result.commuteExtraMinutes;
        break;
      case "studyEndPreferred":
        result.studyEndPreferred = value;
        break;
      case "studyEndHard":
        result.studyEndHard = value;
        break;
      case "showerAndBreakMinutes":
        result.showerAndBreakMinutes = Number(value) || result.showerAndBreakMinutes;
        break;
      case "notificationAfterSchoolMinutes":
        result.notificationAfterSchoolMinutes = Number(value) ||
          result.notificationAfterSchoolMinutes;
        break;
    }
  }
  return result;
}
