import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  getCurrentLesson,
  getDayLessons,
  getWarsawNow,
  type GroupPrefs,
  LESSON_SLOTS,
  SUBJECT_COLORS,
  TIMETABLE_META,
  type Weekday,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  weekdayFromDate,
} from "@chatgpa/core";
import { loadGroupPrefs, saveGroupPrefs } from "../lib/timetable-storage.ts";
import Icon from "./Icon.tsx";

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

interface TimetablePanelProps {
  onBack: () => void;
  embedded?: boolean;
}

export default function TimetablePanel({ onBack, embedded = false }: TimetablePanelProps) {
  const prefs = useSignal<GroupPrefs>(loadGroupPrefs());
  const selectedDay = useSignal<Weekday>(weekdayFromDate(getWarsawNow()) ?? "mon");
  const nowTick = useSignal(0);

  useEffect(() => {
    const id = setInterval(() => {
      nowTick.value++;
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const current = () => getCurrentLesson(prefs.value);
  const today = () => weekdayFromDate(getWarsawNow());
  const now = () => getWarsawNow();

  function setPref<K extends keyof GroupPrefs>(key: K, value: GroupPrefs[K]) {
    const next = { ...prefs.value, [key]: value };
    prefs.value = next;
    saveGroupPrefs(next);
  }

  function isCurrentSlot(day: Weekday, slot: number): boolean {
    void nowTick.value;
    const info = current();
    return info.status === "during" && info.day === day && info.slot === slot;
  }

  function isToday(day: Weekday): boolean {
    void nowTick.value;
    return today() === day;
  }

  return (
    <div class={`timetable${embedded ? " timetable--embedded" : ""}`}>
      <header class="timetable-header">
        {!embedded && (
          <button type="button" class="timetable-back" onClick={onBack} aria-label="Wróć do czatu">
            <Icon name="arrow-left" /> Czat
          </button>
        )}
        <div class="timetable-header-text">
          <h1 class="timetable-title">Plan lekcji</h1>
          <p class="timetable-subtitle">
            {TIMETABLE_META.className} · {TIMETABLE_META.school}
          </p>
        </div>
      </header>

      <CurrentLessonCard info={current()} now={now()} />

      <section class="timetable-groups" aria-label="Grupy lekcyjne">
        <h2 class="timetable-section-title">Twoje grupy</h2>
        <div class="timetable-group-grid">
          <GroupToggle
            label="Język obcy"
            options={["Hiszpański (1)", "Niemiecki (2)"]}
            value={prefs.value.language}
            onChange={(v) => setPref("language", v as 1 | 2)}
          />
          <GroupToggle
            label="Angielski"
            options={["Grupa 1", "Grupa 2"]}
            value={prefs.value.english}
            onChange={(v) => setPref("english", v as 1 | 2)}
          />
          <GroupToggle
            label="WF"
            options={["Grupa 1", "Grupa 2"]}
            value={prefs.value.pe}
            onChange={(v) => setPref("pe", v as 1 | 2)}
          />
          <GroupToggle
            label="Informatyka"
            options={["Grupa 1", "Grupa 2"]}
            value={prefs.value.informatics}
            onChange={(v) => setPref("informatics", v as 1 | 2)}
          />
        </div>
      </section>

      <nav class="timetable-days" aria-label="Dni tygodnia">
        {WEEKDAYS.map((day) => (
          <button
            key={day}
            type="button"
            class={`timetable-day-tab${
              selectedDay.value === day ? " timetable-day-tab--active" : ""
            }${isToday(day) ? " timetable-day-tab--today" : ""}`}
            onClick={() => {
              selectedDay.value = day;
            }}
          >
            <span class="timetable-day-short">{WEEKDAY_SHORT[day]}</span>
            <span class="timetable-day-full">{WEEKDAY_LABELS[day]}</span>
          </button>
        ))}
      </nav>

      <div class="timetable-lessons">
        {getDayLessons(selectedDay.value, prefs.value).map((entry) => (
          <LessonCard
            key={entry.slot}
            slot={entry.slot}
            time={entry.time}
            lesson={entry.lesson}
            active={isCurrentSlot(selectedDay.value, entry.slot)}
            today={isToday(selectedDay.value)}
          />
        ))}
      </div>

      <details class="timetable-week-overview">
        <summary>Pełny tydzień</summary>
        <div class="timetable-grid-wrap">
          <table class="timetable-grid">
            <thead>
              <tr>
                <th>Godz.</th>
                {WEEKDAYS.map((day) => (
                  <th
                    key={day}
                    class={isToday(day) ? "timetable-grid-th--today" : ""}
                  >
                    {WEEKDAY_SHORT[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LESSON_SLOTS.map((time, i) => {
                const slot = i + 1;
                return (
                  <tr key={slot}>
                    <td class="timetable-grid-time">
                      {time.start}
                    </td>
                    {WEEKDAYS.map((day) => {
                      const entry = getDayLessons(day, prefs.value).find((e) => e.slot === slot);
                      const lesson = entry?.lesson;
                      const active = isCurrentSlot(day, slot);
                      const color = lesson ? SUBJECT_COLORS[lesson.subject] ?? "var(--muted)" : "";
                      return (
                        <td
                          key={day}
                          class={`timetable-grid-cell${
                            active ? " timetable-grid-cell--active" : ""
                          }${isToday(day) ? " timetable-grid-cell--today" : ""}${
                            !lesson ? " timetable-grid-cell--empty" : ""
                          }`}
                          style={lesson
                            ? { "--subject-color": color } as Record<string, string>
                            : undefined}
                        >
                          {lesson
                            ? (
                              <>
                                <span class="timetable-grid-subject">{lesson.short}</span>
                                <span class="timetable-grid-room">{lesson.room}</span>
                              </>
                            )
                            : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function CurrentLessonCard({
  info,
  now,
}: {
  info: ReturnType<typeof getCurrentLesson>;
  now: Date;
}) {
  const timeStr = now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

  if (info.status === "weekend") {
    return (
      <div class="timetable-now timetable-now--weekend">
        <span class="timetable-now-label">Weekend</span>
        <p class="timetable-now-text">Brak lekcji — odpocznij!</p>
      </div>
    );
  }

  if (info.status === "during" && info.lesson && info.time) {
    const color = SUBJECT_COLORS[info.lesson.subject] ?? "var(--accent)";
    return (
      <div
        class="timetable-now timetable-now--live"
        style={{ "--subject-color": color } as Record<string, string>}
      >
        <div class="timetable-now-badge">Teraz trwa</div>
        <h2 class="timetable-now-subject">{info.lesson.subject}</h2>
        <p class="timetable-now-meta">
          {info.time.start}–{info.time.end} · sala {info.lesson.room} · {info.lesson.teacher}
        </p>
      </div>
    );
  }

  if (info.nextLesson) {
    const { lesson, time, slot } = info.nextLesson;
    const dayLabel = WEEKDAY_LABELS[info.nextLesson.day];
    const color = SUBJECT_COLORS[lesson.subject] ?? "var(--accent)";
    return (
      <div class="timetable-now" style={{ "--subject-color": color } as Record<string, string>}>
        <span class="timetable-now-label">Teraz {timeStr}</span>
        <h2 class="timetable-now-subject">Następna: {lesson.subject}</h2>
        <p class="timetable-now-meta">
          {dayLabel}, lekcja {slot} · {time.start}–{time.end} · sala {lesson.room}
        </p>
      </div>
    );
  }

  return (
    <div class="timetable-now timetable-now--done">
      <span class="timetable-now-label">Teraz {timeStr}</span>
      <p class="timetable-now-text">Koniec lekcji na ten tydzień</p>
    </div>
  );
}

function GroupToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string];
  value: 1 | 2;
  onChange: (v: 1 | 2) => void;
}) {
  return (
    <div class="timetable-group">
      <span class="timetable-group-label">{label}</span>
      <div class="timetable-group-btns">
        {([1, 2] as const).map((n) => (
          <button
            key={n}
            type="button"
            class={`timetable-group-btn${value === n ? " timetable-group-btn--active" : ""}`}
            onClick={() => onChange(n)}
          >
            {options[n - 1]}
          </button>
        ))}
      </div>
    </div>
  );
}

function LessonCard({
  slot,
  time,
  lesson,
  active,
  today,
}: {
  slot: number;
  time: { start: string; end: string };
  lesson: { subject: string; short: string; teacher: string; room: string } | null;
  active: boolean;
  today: boolean;
}) {
  if (!lesson) {
    return (
      <div
        class={`timetable-lesson timetable-lesson--empty${today ? " timetable-lesson--today" : ""}`}
      >
        <div class="timetable-lesson-time">
          <span class="timetable-lesson-slot">{slot}</span>
          <span>{time.start}–{time.end}</span>
        </div>
        <span class="timetable-lesson-empty-label">Wolne</span>
      </div>
    );
  }

  const color = SUBJECT_COLORS[lesson.subject] ?? "var(--accent)";

  return (
    <div
      class={`timetable-lesson${active ? " timetable-lesson--active" : ""}${
        today ? " timetable-lesson--today" : ""
      }`}
      style={{ "--subject-color": color } as Record<string, string>}
    >
      <div class="timetable-lesson-time">
        <span class="timetable-lesson-slot">{slot}</span>
        <span>{time.start}–{time.end}</span>
      </div>
      <div class="timetable-lesson-body">
        <span class="timetable-lesson-subject">{lesson.subject}</span>
        <span class="timetable-lesson-meta">
          {lesson.teacher} · sala {lesson.room}
        </span>
      </div>
      {active && <span class="timetable-lesson-live">Na żywo</span>}
    </div>
  );
}
