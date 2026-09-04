export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";

export interface LessonSlot {
  start: string;
  end: string;
}

export interface Lesson {
  subject: string;
  short: string;
  teacher: string;
  room: string;
  group?: number;
}

export interface TimetableEntry {
  slot: number;
  lessons: Lesson[];
}

export interface GroupPrefs {
  language: 1 | 2;
  english: 1 | 2;
  pe: 1 | 2;
  informatics: 1 | 2;
}

export interface TimetableMeta {
  school: string;
  address: string;
  className: string;
  generatedAt: string;
}

export const TIMETABLE_META: TimetableMeta = {
  school: "CXXII Liceum Ogólnokształcące w Warszawie",
  address: "ul. Staffa 3/5",
  className: "3A",
  generatedAt: "2025-08-27",
};

export const LESSON_SLOTS: LessonSlot[] = [
  { start: "08:00", end: "08:45" },
  { start: "08:55", end: "09:40" },
  { start: "09:50", end: "10:35" },
  { start: "10:45", end: "11:30" },
  { start: "11:40", end: "12:25" },
  { start: "12:45", end: "13:30" },
  { start: "13:50", end: "14:35" },
  { start: "14:45", end: "15:30" },
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Poniedziałek",
  tue: "Wtorek",
  wed: "Środa",
  thu: "Czwartek",
  fri: "Piątek",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: "Pn",
  tue: "Wt",
  wed: "Śr",
  thu: "Czw",
  fri: "Pi",
};

export const SUBJECT_COLORS: Record<string, string> = {
  Matematyka: "#e8a54b",
  Geografia: "#6ab87a",
  "Język polski": "#c97bb8",
  "Edukacja zdrowotna": "#7eb8d4",
  "Język niemiecki": "#8b9fd4",
  "Język hiszpański": "#d47a6a",
  "Język angielski": "#5a9fd4",
  Biologia: "#6ab87a",
  Informatyka: "#9b8fd4",
  Fizyka: "#7eb8d4",
  "Wychowanie fizyczne": "#d4a56a",
  Chemia: "#b87ad4",
  Religia: "#a89f92",
  "Edukacja obywatelska": "#8b9fd4",
  Historia: "#d4a56a",
  "Zajęcia wychowawcze": "#c97bb8",
};

const L = (
  short: string,
  subject: string,
  teacher: string,
  room: string,
  group?: number,
): Lesson => ({ short, subject, teacher, room, group });

export const TIMETABLE: Record<Weekday, TimetableEntry[]> = {
  mon: [
    { slot: 1, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    { slot: 2, lessons: [L("Geogr.", "Geografia", "KoMa", "D10")] },
    { slot: 3, lessons: [L("Jęz. pol.", "Język polski", "RuEw", "J12")] },
    { slot: 4, lessons: [L("E. zdr.", "Edukacja zdrowotna", "MiAl", "D1")] },
    {
      slot: 5,
      lessons: [
        L("Jęz. hisz.", "Język hiszpański", "BiAg", "K2", 1),
        L("Jęz. niem.", "Język niemiecki", "P13a", "K2", 2),
      ],
    },
    {
      slot: 6,
      lessons: [
        L("Jęz. ang.", "Język angielski", "AdMa", "J8", 1),
        L("Jęz. ang.", "Język angielski", "IzMi", "102", 2),
      ],
    },
    { slot: 7, lessons: [L("Biol.", "Biologia", "PaEw", "D9")] },
    { slot: 8, lessons: [L("Infor.", "Informatyka", "KiNo", "J17", 1)] },
  ],
  tue: [
    {
      slot: 1,
      lessons: [
        L("Jęz. hisz.", "Język hiszpański", "BiAg", "K2", 1),
        L("Jęz. niem.", "Język niemiecki", "P13a", "K2", 2),
      ],
    },
    { slot: 2, lessons: [L("Fiz.", "Fizyka", "JaKr", "D3")] },
    { slot: 3, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    {
      slot: 4,
      lessons: [
        L("WF", "Wychowanie fizyczne", "PaMa", "S3", 1),
        L("WF", "Wychowanie fizyczne", "ReAl", "S2", 2),
      ],
    },
    { slot: 5, lessons: [L("Jęz. pol.", "Język polski", "RuEw", "J12")] },
    { slot: 6, lessons: [L("Chem.", "Chemia", "ŁaAn", "D12")] },
    {
      slot: 7,
      lessons: [
        L("Jęz. ang.", "Język angielski", "AdMa", "J8", 1),
        L("Jęz. ang.", "Język angielski", "IzMi", "102", 2),
      ],
    },
    { slot: 8, lessons: [] },
  ],
  wed: [
    {
      slot: 1,
      lessons: [
        L("Jęz. ang.", "Język angielski", "AdMa", "J8", 1),
        L("Jęz. ang.", "Język angielski", "IzMi", "102", 2),
      ],
    },
    {
      slot: 2,
      lessons: [
        L("Jęz. ang.", "Język angielski", "AdMa", "J8", 1),
        L("Jęz. ang.", "Język angielski", "IzMi", "102", 2),
      ],
    },
    { slot: 3, lessons: [L("Fiz.", "Fizyka", "JaKr", "D10")] },
    { slot: 4, lessons: [L("Fiz.", "Fizyka", "JaKr", "P12")] },
    {
      slot: 5,
      lessons: [
        L("WF", "Wychowanie fizyczne", "PaMa", "S4", 1),
        L("WF", "Wychowanie fizyczne", "ReAl", "S3", 2),
      ],
    },
    { slot: 6, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    { slot: 7, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    { slot: 8, lessons: [L("Rel.", "Religia", "CźEw", "103")] },
  ],
  thu: [
    { slot: 1, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    { slot: 2, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    { slot: 3, lessons: [L("Edu. obywat.", "Edukacja obywatelska", "FrAn", "P12")] },
    {
      slot: 4,
      lessons: [
        L("Jęz. ang.", "Język angielski", "AdMa", "J8", 1),
        L("Jęz. ang.", "Język angielski", "IzMi", "102", 2),
      ],
    },
    { slot: 5, lessons: [L("Fiz.", "Fizyka", "JaKr", "D10")] },
    { slot: 6, lessons: [L("Hist.", "Historia", "FiMa", "P10")] },
    { slot: 7, lessons: [L("Jęz. pol.", "Język polski", "RuEw", "J12")] },
    { slot: 8, lessons: [L("Infor.", "Informatyka", "KiNo", "J17", 2)] },
  ],
  fri: [
    { slot: 1, lessons: [L("Hist.", "Historia", "FiMa", "P10")] },
    { slot: 2, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    { slot: 3, lessons: [L("Mat.", "Matematyka", "ToDo", "D9")] },
    {
      slot: 4,
      lessons: [
        L("WF", "Wychowanie fizyczne", "PaMa", "S2", 1),
        L("WF", "Wychowanie fizyczne", "ReAl", "S6", 2),
      ],
    },
    { slot: 5, lessons: [L("Jęz. pol.", "Język polski", "RuEw", "J12")] },
    { slot: 6, lessons: [L("Zaj/godz wych.", "Zajęcia wychowawcze", "IzMi", "J14")] },
    { slot: 7, lessons: [] },
    { slot: 8, lessons: [] },
  ],
};

export const DEFAULT_GROUP_PREFS: GroupPrefs = {
  language: 1,
  english: 1,
  pe: 1,
  informatics: 1,
};

const WEEKDAY_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

export function weekdayFromDate(date: Date): Weekday | null {
  const day = date.getDay();
  const map: Record<number, Weekday | null> = {
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    0: null,
    6: null,
  };
  return map[day] ?? null;
}

function groupKey(lesson: Lesson): keyof GroupPrefs | null {
  if (lesson.subject === "Język hiszpański" || lesson.subject === "Język niemiecki") {
    return "language";
  }
  if (lesson.subject === "Język angielski") return "english";
  if (lesson.subject === "Wychowanie fizyczne") return "pe";
  if (lesson.subject === "Informatyka") return "informatics";
  return null;
}

export function resolveLesson(lesson: Lesson, prefs: GroupPrefs): boolean {
  if (!lesson.group) return true;
  const key = groupKey(lesson);
  if (!key) return true;
  return lesson.group === prefs[key];
}

export function getDayLessons(
  day: Weekday,
  prefs: GroupPrefs = DEFAULT_GROUP_PREFS,
): Array<{ slot: number; time: LessonSlot; lesson: Lesson | null }> {
  return TIMETABLE[day].map((entry) => {
    const time = LESSON_SLOTS[entry.slot - 1];
    const lesson = entry.lessons.find((l) => resolveLesson(l, prefs)) ?? null;
    return { slot: entry.slot, time, lesson };
  });
}

export function formatLessonLine(lesson: Lesson, time: LessonSlot, slot: number): string {
  return `${slot}. ${time.start}–${time.end}: ${lesson.subject} (${lesson.teacher}, sala ${lesson.room})`;
}

export function formatDaySchedule(
  day: Weekday,
  prefs: GroupPrefs = DEFAULT_GROUP_PREFS,
): string {
  const label = WEEKDAY_LABELS[day];
  const lines = getDayLessons(day, prefs)
    .filter((e) => e.lesson)
    .map((e) => formatLessonLine(e.lesson!, e.time, e.slot));
  if (!lines.length) return `${label}: brak lekcji`;
  return `${label}:\n${lines.join("\n")}`;
}

export function formatTimetableForAi(prefs: GroupPrefs = DEFAULT_GROUP_PREFS): string {
  const header = [
    `Plan lekcji klasy ${TIMETABLE_META.className}`,
    `${TIMETABLE_META.school}, ${TIMETABLE_META.address}`,
    `Grupy ucznia: język obcy ${prefs.language}, angielski ${prefs.english}, WF ${prefs.pe}, informatyka ${prefs.informatics}`,
    "",
  ];
  const days = WEEKDAY_ORDER.map((d) => formatDaySchedule(d, prefs));
  return [...header, ...days].join("\n");
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Fake Date whose local getHours/getDay match Europe/Warsaw wall clock.
 * Safe for `.getHours()` / `weekdayFromDate()` only.
 * Do NOT pass into Intl formatters with `timeZone: "Europe/Warsaw"` — that double-shifts
 * on UTC hosts (Deno Deploy). Prefer `new Date()` + explicit Warsaw `timeZone` instead.
 */
export function getWarsawNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }),
  );
}

export interface CurrentLessonInfo {
  status: "before" | "during" | "after" | "weekend";
  day: Weekday | null;
  slot: number | null;
  lesson: Lesson | null;
  time: LessonSlot | null;
  nextLesson: { day: Weekday; slot: number; lesson: Lesson; time: LessonSlot } | null;
}

export function getCurrentLesson(
  prefs: GroupPrefs = DEFAULT_GROUP_PREFS,
  now: Date = getWarsawNow(),
): CurrentLessonInfo {
  const day = weekdayFromDate(now);
  if (!day) {
    return { status: "weekend", day: null, slot: null, lesson: null, time: null, nextLesson: null };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const dayLessons = getDayLessons(day, prefs).filter((e) => e.lesson);

  for (const entry of dayLessons) {
    const start = parseTimeToMinutes(entry.time.start);
    const end = parseTimeToMinutes(entry.time.end);
    if (minutes >= start && minutes < end) {
      return {
        status: "during",
        day,
        slot: entry.slot,
        lesson: entry.lesson,
        time: entry.time,
        nextLesson: findNextLesson(day, entry.slot, prefs),
      };
    }
    if (minutes < start) {
      return {
        status: "before",
        day,
        slot: entry.slot,
        lesson: entry.lesson,
        time: entry.time,
        nextLesson: {
          day,
          slot: entry.slot,
          lesson: entry.lesson!,
          time: entry.time,
        },
      };
    }
  }

  return {
    status: "after",
    day,
    slot: null,
    lesson: null,
    time: null,
    nextLesson: findNextLesson(day, 8, prefs),
  };
}

function findNextLesson(
  fromDay: Weekday,
  afterSlot: number,
  prefs: GroupPrefs,
): { day: Weekday; slot: number; lesson: Lesson; time: LessonSlot } | null {
  const startIdx = WEEKDAY_ORDER.indexOf(fromDay);
  for (let d = startIdx; d < WEEKDAY_ORDER.length; d++) {
    const day = WEEKDAY_ORDER[d];
    const lessons = getDayLessons(day, prefs).filter((e) => e.lesson);
    for (const entry of lessons) {
      if (d === startIdx && entry.slot <= afterSlot) continue;
      return { day, slot: entry.slot, lesson: entry.lesson!, time: entry.time };
    }
  }
  return null;
}
