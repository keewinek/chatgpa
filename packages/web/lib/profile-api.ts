import type { TimeProfile } from "@chatgpa/core";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchProfile(): Promise<TimeProfile> {
  const res = await fetch("/api/profile");
  return parseJson<TimeProfile>(res);
}

export async function saveProfile(patch: Partial<TimeProfile>): Promise<TimeProfile> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<TimeProfile>(res);
}

export function formatStudyExample(profile: TimeProfile): string {
  const lastLesson = "15:00";
  const [h, m] = lastLesson.split(":").map(Number);
  const startMin = h * 60 + m +
    profile.commuteAfterSchoolMinutes +
    profile.commuteExtraMinutes +
    profile.showerAndBreakMinutes;
  const startH = Math.floor(startMin / 60);
  const startM = startMin % 60;
  const studyStart = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
  return `Przykład dnia szkolnego: powrót ~${
    formatAddMinutes(lastLesson, profile.commuteAfterSchoolMinutes)
  }, nauka od ~${studyStart} do ${profile.studyEndPreferred}`;
}

function formatAddMinutes(time: string, add: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + add;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${
    String(total % 60).padStart(2, "0")
  }`;
}
