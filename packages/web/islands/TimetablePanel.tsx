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
import { loadGroupPrefsAsync } from "../lib/timetable-storage.ts";
import Icon from "./Icon.tsx";

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

interface TimetablePanelProps {
  onBack: () => void;
  embedded?: boolean;
}

export default function TimetablePanel({ onBack, embedded = false }: TimetablePanelProps) {
  const prefs = useSignal<GroupPrefs | null>(null);
  const nowTick = useSignal(0);

  useEffect(() => {
    void loadGroupPrefsAsync().then((p) => {
      prefs.value = p;
    });
    const id = setInterval(() => {
      nowTick.value++;
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const current = () => prefs.value ? getCurrentLesson(prefs.value) : null;
  const today = () => {
    void nowTick.value;
    return weekdayFromDate(getWarsawNow());
  };

  function isCurrentSlot(day: Weekday, slot: number): boolean {
    void nowTick.value;
    const info = current();
    return Boolean(info && info.status === "during" && info.day === day && info.slot === slot);
  }

  const todayKey = today();

  return (
    <div class={`tt${embedded ? " tt--embedded" : ""}`}>
      <header class="tt-toolbar">
        {!embedded && (
          <button type="button" class="tt-icon-btn" onClick={onBack} aria-label="Wróć" title="Wróć">
            <Icon name="arrow-left" />
          </button>
        )}
        <div class="tt-toolbar-text">
          <h1 class="tt-title">Plan lekcji</h1>
          <p class="tt-meta">
            {TIMETABLE_META.className} · {TIMETABLE_META.school}
          </p>
        </div>
      </header>

      <NowStrip info={current()} />

      {!prefs.value
        ? <p class="tt-loading">Ładowanie…</p>
        : (
          <div class="tt-grid-wrap" role="region" aria-label="Tydzień">
            <table class="tt-grid">
              <thead>
                <tr>
                  <th class="tt-grid-corner" scope="col">
                    <span class="tt-sr">Godzina</span>
                  </th>
                  {WEEKDAYS.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      class={`tt-grid-day${todayKey === day ? " tt-grid-day--today" : ""}`}
                    >
                      <span class="tt-grid-day-short">{WEEKDAY_SHORT[day]}</span>
                      <span class="tt-grid-day-full">{WEEKDAY_LABELS[day]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LESSON_SLOTS.map((time, i) => {
                  const slot = i + 1;
                  return (
                    <tr key={slot}>
                      <th class="tt-grid-time" scope="row">
                        <span class="tt-grid-time-start">{time.start}</span>
                        <span class="tt-grid-time-end">{time.end}</span>
                      </th>
                      {WEEKDAYS.map((day) => {
                        const entry = getDayLessons(day, prefs.value!).find((e) => e.slot === slot);
                        const lesson = entry?.lesson ?? null;
                        const active = isCurrentSlot(day, slot);
                        const color = lesson
                          ? SUBJECT_COLORS[lesson.subject] ?? "var(--accent)"
                          : undefined;
                        return (
                          <td
                            key={day}
                            class={[
                              "tt-cell",
                              lesson ? "tt-cell--lesson" : "tt-cell--empty",
                              active ? "tt-cell--now" : "",
                              todayKey === day ? "tt-cell--today" : "",
                            ].filter(Boolean).join(" ")}
                            style={color
                              ? { "--subject-color": color } as Record<string, string>
                              : undefined}
                            title={lesson
                              ? `${lesson.subject} · ${lesson.teacher} · sala ${lesson.room}`
                              : undefined}
                          >
                            {lesson
                              ? (
                                <>
                                  <span class="tt-cell-subject">{lesson.short}</span>
                                  <span class="tt-cell-room">{lesson.room}</span>
                                </>
                              )
                              : <span class="tt-cell-dash">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function NowStrip({
  info,
}: {
  info: ReturnType<typeof getCurrentLesson> | null;
}) {
  if (!info) return null;

  const timeStr = getWarsawNow().toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (info.status === "weekend") {
    return (
      <div class="tt-now tt-now--muted">
        <span class="tt-now-time">{timeStr}</span>
        <span class="tt-now-text">Weekend — brak lekcji</span>
      </div>
    );
  }

  if (info.status === "during" && info.lesson && info.time) {
    const color = SUBJECT_COLORS[info.lesson.subject] ?? "var(--accent)";
    return (
      <div
        class="tt-now tt-now--live"
        style={{ "--subject-color": color } as Record<string, string>}
      >
        <span class="tt-now-time">{timeStr}</span>
        <span class="tt-now-text">
          <strong>{info.lesson.subject}</strong>
          {" · "}
          {info.time.start}–{info.time.end}
          {" · sala "}
          {info.lesson.room}
        </span>
      </div>
    );
  }

  if (info.nextLesson) {
    const { lesson, time, slot, day } = info.nextLesson;
    return (
      <div class="tt-now">
        <span class="tt-now-time">{timeStr}</span>
        <span class="tt-now-text">
          Następna: <strong>{lesson.subject}</strong>
          {" · "}
          {WEEKDAY_LABELS[day]}, lekcja {slot}, {time.start}–{time.end}
        </span>
      </div>
    );
  }

  return (
    <div class="tt-now tt-now--muted">
      <span class="tt-now-time">{timeStr}</span>
      <span class="tt-now-text">Koniec lekcji na ten tydzień</span>
    </div>
  );
}
