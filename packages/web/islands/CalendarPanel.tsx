import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { CalEvent } from "@chatgpa/core";
import { getWarsawNow } from "@chatgpa/core";
import {
  dateKey,
  fetchCalendarEvents,
  fetchFreeSlots,
  KIND_COLORS,
  KIND_LABELS,
} from "../lib/calendar-api.ts";
import Icon from "./Icon.tsx";

interface CalendarPanelProps {
  onBack: () => void;
  onOpenProfile?: () => void;
  /** When true, hide back-to-chat chrome (opened from .ui shortcut). */
  embedded?: boolean;
}

type ViewMode = "month" | "week" | "day";

const WEEKDAY_NAMES = ["Pn", "Wt", "Śr", "Czw", "Pt", "So", "Nd"];
const WEEKDAY_FULL = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
];
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const GRID_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventEndMinutes(e: CalEvent): number {
  if (e.end) return minutesOfDay(e.end);
  return minutesOfDay(e.start) + 60;
}

function eventLayout(e: CalEvent): { top: string; height: string } | null {
  const start = minutesOfDay(e.start) - DAY_START_HOUR * 60;
  const end = eventEndMinutes(e) - DAY_START_HOUR * 60;
  if (end <= 0 || start >= GRID_MINUTES) return null;
  const clampedStart = Math.max(0, start);
  const clampedEnd = Math.min(GRID_MINUTES, end);
  const duration = Math.max(clampedEnd - clampedStart, 20);
  return {
    top: `${(clampedStart / GRID_MINUTES) * 100}%`,
    height: `${(duration / GRID_MINUTES) * 100}%`,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CalendarPanel({
  onBack,
  onOpenProfile,
  embedded = false,
}: CalendarPanelProps) {
  const viewMode = useSignal<ViewMode>("week");
  const cursor = useSignal(getWarsawNow());
  const events = useSignal<CalEvent[]>([]);
  const freeMinutes = useSignal<number | null>(null);
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const selectedDate = useSignal(dateKey(getWarsawNow()));

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const c = cursor.value;
      let from: string;
      let to: string;
      if (viewMode.value === "month") {
        const weekStart = startOfWeek(new Date(c.getFullYear(), c.getMonth(), 1));
        const last = daysInMonth(c.getFullYear(), c.getMonth() + 1);
        const weekEnd = addDays(
          startOfWeek(new Date(c.getFullYear(), c.getMonth(), last)),
          6,
        );
        from = dateKey(weekStart);
        to = dateKey(weekEnd);
      } else if (viewMode.value === "week") {
        const weekStart = startOfWeek(c);
        from = dateKey(weekStart);
        to = dateKey(addDays(weekStart, 6));
      } else {
        from = selectedDate.value;
        to = selectedDate.value;
      }
      events.value = await fetchCalendarEvents(from, to);
      const slots = await fetchFreeSlots(selectedDate.value);
      freeMinutes.value = slots.freeMinutes;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      events.value = [];
    } finally {
      loading.value = false;
    }
  }

  useEffect(() => {
    void load();
  }, [viewMode.value, cursor.value, selectedDate.value]);

  function goToday() {
    const now = getWarsawNow();
    cursor.value = now;
    selectedDate.value = dateKey(now);
  }

  function prev() {
    const d = new Date(cursor.value);
    if (viewMode.value === "month") d.setMonth(d.getMonth() - 1);
    else if (viewMode.value === "week") d.setDate(d.getDate() - 7);
    else {
      d.setDate(d.getDate() - 1);
      selectedDate.value = dateKey(d);
    }
    cursor.value = d;
  }

  function next() {
    const d = new Date(cursor.value);
    if (viewMode.value === "month") d.setMonth(d.getMonth() + 1);
    else if (viewMode.value === "week") d.setDate(d.getDate() + 7);
    else {
      d.setDate(d.getDate() + 1);
      selectedDate.value = dateKey(d);
    }
    cursor.value = d;
  }

  function eventsOnDate(date: string): CalEvent[] {
    return events.value
      .filter((e) => e.start.slice(0, 10) === date)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  function selectDay(date: string) {
    selectedDate.value = date;
    const [y, m, d] = date.split("-").map(Number);
    cursor.value = new Date(y, m - 1, d);
  }

  const today = dateKey(getWarsawNow());
  const titleLabel = (() => {
    const c = cursor.value;
    if (viewMode.value === "day") {
      const d = new Date(selectedDate.value + "T12:00:00");
      return capitalize(
        d.toLocaleDateString("pl-PL", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      );
    }
    if (viewMode.value === "week") {
      const ws = startOfWeek(c);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      if (sameMonth) {
        return capitalize(
          ws.toLocaleDateString("pl-PL", { month: "long", year: "numeric" }),
        );
      }
      return `${ws.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} – ${
        we.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })
      }`;
    }
    return capitalize(
      c.toLocaleDateString("pl-PL", { month: "long", year: "numeric" }),
    );
  })();

  const weekStart = startOfWeek(cursor.value);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i,
  );

  const monthGrid = () => {
    const c = cursor.value;
    const year = c.getFullYear();
    const month = c.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = daysInMonth(year, month + 1);
    const leading = startOfWeek(firstDay);
    const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < startOffset; i++) {
      const d = addDays(leading, i);
      cells.push({ date: dateKey(d), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d, inMonth: true });
    }
    while (cells.length % 7 !== 0 || cells.length < 35) {
      const last = cells[cells.length - 1];
      const [y, m, day] = last.date.split("-").map(Number);
      const next = addDays(new Date(y, m - 1, day), 1);
      cells.push({ date: dateKey(next), day: next.getDate(), inMonth: false });
      if (cells.length >= 42) break;
    }
    return cells;
  };

  function renderTimeGrid(days: Date[]) {
    return (
      <div class="gcal-timegrid">
        <div class="gcal-timegrid-corner" />
        <div
          class="gcal-timegrid-head"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((d) => {
            const key = dateKey(d);
            const isToday = key === today;
            const isSelected = key === selectedDate.value;
            return (
              <button
                key={key}
                type="button"
                class={`gcal-timegrid-dayhead${isToday ? " gcal-timegrid-dayhead--today" : ""}${
                  isSelected ? " gcal-timegrid-dayhead--selected" : ""
                }`}
                onClick={() => {
                  selectDay(key);
                  if (viewMode.value === "week") viewMode.value = "day";
                }}
              >
                <span class="gcal-timegrid-weekday">
                  {WEEKDAY_NAMES[(d.getDay() + 6) % 7]}
                </span>
                <span class="gcal-timegrid-date">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <div class="gcal-timegrid-hours">
          {hours.map((h) => (
            <div key={h} class="gcal-timegrid-hour">
              <span>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        <div
          class="gcal-timegrid-cols"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((d) => {
            const key = dateKey(d);
            const dayEvents = eventsOnDate(key);
            return (
              <div
                key={key}
                class={`gcal-timegrid-col${key === today ? " gcal-timegrid-col--today" : ""}`}
              >
                {hours.map((h) => <div key={h} class="gcal-timegrid-slot" />)}
                {dayEvents.map((e) => {
                  const layout = eventLayout(e);
                  if (!layout) return null;
                  return (
                    <div
                      key={e.id}
                      class="gcal-event-block"
                      style={{
                        top: layout.top,
                        height: layout.height,
                        background: KIND_COLORS[e.kind],
                      }}
                      title={`${e.title} · ${KIND_LABELS[e.kind]}`}
                    >
                      <span class="gcal-event-block-time">{formatTime(e.start)}</span>
                      <span class="gcal-event-block-title">{e.title}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div class={`calendar-panel gcal${embedded ? " calendar-panel--embedded" : ""}`}>
      <header class="gcal-toolbar">
        {!embedded && (
          <button type="button" class="gcal-back" onClick={onBack}>
            <Icon name="arrow-left" />
          </button>
        )}
        <button type="button" class="gcal-today" onClick={goToday}>
          Dziś
        </button>
        <div class="gcal-nav">
          <button type="button" class="gcal-nav-btn" onClick={prev} aria-label="Wstecz">
            <Icon name="chevron-left" />
          </button>
          <button type="button" class="gcal-nav-btn" onClick={next} aria-label="Dalej">
            <Icon name="chevron-right" />
          </button>
        </div>
        <h2 class="gcal-title">{titleLabel}</h2>
        <div class="gcal-toolbar-end">
          {freeMinutes.value !== null && (
            <span class="gcal-budget" title="Wolne minuty na naukę dziś">
              ~{freeMinutes.value} min
            </span>
          )}
          {onOpenProfile && (
            <button
              type="button"
              class="gcal-icon-btn"
              onClick={onOpenProfile}
              title="Profil czasu"
              aria-label="Profil czasu"
            >
              <Icon name="user-clock" />
            </button>
          )}
          <div class="gcal-view-toggle" role="group" aria-label="Widok">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                class={`gcal-view-btn${viewMode.value === mode ? " gcal-view-btn--active" : ""}`}
                onClick={() => {
                  viewMode.value = mode;
                  if (mode === "day") {
                    const [y, m, d] = selectedDate.value.split("-").map(Number);
                    cursor.value = new Date(y, m - 1, d);
                  }
                }}
              >
                {mode === "day" ? "Dzień" : mode === "week" ? "Tydzień" : "Miesiąc"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error.value && <p class="calendar-error">{error.value}</p>}
      {loading.value && <p class="calendar-loading">Ładowanie…</p>}

      {!loading.value && viewMode.value === "month" && (
        <div class="gcal-month">
          <div class="gcal-month-weekdays">
            {WEEKDAY_NAMES.map((d) => <span key={d} class="gcal-month-weekday">{d}</span>)}
          </div>
          <div class="gcal-month-grid">
            {monthGrid().map((cell) => {
              const dayEvents = eventsOnDate(cell.date);
              const isToday = cell.date === today;
              const isSelected = cell.date === selectedDate.value;
              return (
                <button
                  key={cell.date}
                  type="button"
                  class={`gcal-month-cell${cell.inMonth ? "" : " gcal-month-cell--muted"}${
                    isToday ? " gcal-month-cell--today" : ""
                  }${isSelected ? " gcal-month-cell--selected" : ""}`}
                  onClick={() => selectDay(cell.date)}
                  onDblClick={() => {
                    selectDay(cell.date);
                    viewMode.value = "day";
                  }}
                >
                  <span class={`gcal-month-daynum${isToday ? " gcal-month-daynum--today" : ""}`}>
                    {cell.day}
                  </span>
                  <div class="gcal-month-events">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        class="gcal-month-chip"
                        style={{ background: KIND_COLORS[e.kind] }}
                      >
                        {e.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span class="gcal-month-more">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading.value && viewMode.value === "week" && renderTimeGrid(weekDays)}

      {!loading.value && viewMode.value === "day" && (
        <div class="gcal-day">
          {renderTimeGrid([
            (() => {
              const [y, m, d] = selectedDate.value.split("-").map(Number);
              return new Date(y, m - 1, d);
            })(),
          ])}
          <aside class="gcal-day-agenda">
            <h3 class="gcal-day-agenda-title">
              {WEEKDAY_FULL[
                (new Date(selectedDate.value + "T12:00:00").getDay() + 6) % 7
              ]}
              {selectedDate.value === today ? " · dziś" : ""}
            </h3>
            <ul class="gcal-day-agenda-list">
              {eventsOnDate(selectedDate.value).length === 0 && (
                <li class="gcal-day-agenda-empty">Brak wydarzeń</li>
              )}
              {eventsOnDate(selectedDate.value).map((e) => (
                <li key={e.id} class="gcal-day-agenda-item">
                  <span
                    class="gcal-day-agenda-dot"
                    style={{ background: KIND_COLORS[e.kind] }}
                  />
                  <div>
                    <div class="gcal-day-agenda-time">
                      {formatTime(e.start)}
                      {e.end ? ` – ${formatTime(e.end)}` : ""}
                    </div>
                    <div class="gcal-day-agenda-name">{e.title}</div>
                    <div class="gcal-day-agenda-kind">{KIND_LABELS[e.kind]}</div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
