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

interface CalendarPanelProps {
  onBack: () => void;
  onOpenProfile?: () => void;
}

type ViewMode = "month" | "week";

const WEEKDAY_NAMES = ["Pn", "Wt", "Śr", "Czw", "Pt", "So", "Nd"];

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

export default function CalendarPanel({ onBack, onOpenProfile }: CalendarPanelProps) {
  const viewMode = useSignal<ViewMode>("month");
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
        from = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-01`;
        const last = daysInMonth(c.getFullYear(), c.getMonth() + 1);
        to = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${
          String(last).padStart(2, "0")
        }`;
      } else {
        const weekStart = startOfWeek(c);
        from = dateKey(weekStart);
        to = dateKey(addDays(weekStart, 6));
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

  function prev() {
    const d = new Date(cursor.value);
    if (viewMode.value === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    cursor.value = d;
  }

  function next() {
    const d = new Date(cursor.value);
    if (viewMode.value === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    cursor.value = d;
  }

  function eventsOnDate(date: string): CalEvent[] {
    return events.value.filter((e) => e.start.slice(0, 10) === date);
  }

  const monthLabel = cursor.value.toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });

  const weekStart = startOfWeek(cursor.value);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthGrid = () => {
    const c = cursor.value;
    const year = c.getFullYear();
    const month = c.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = daysInMonth(year, month + 1);
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= totalDays; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d });
    }
    return cells;
  };

  const today = dateKey(getWarsawNow());

  return (
    <div class="calendar-panel">
      <header class="calendar-header">
        <button type="button" class="calendar-back" onClick={onBack}>
          ← Czat
        </button>
        <div class="calendar-header-text">
          <h2 class="calendar-title">Kalendarz</h2>
          <p class="calendar-subtitle">
            {monthLabel}
            {freeMinutes.value !== null && (
              <span class="calendar-budget">
                · dziś ~{freeMinutes.value} min na naukę
              </span>
            )}
          </p>
        </div>
        <div class="calendar-header-actions">
          {onOpenProfile && (
            <button
              type="button"
              class="calendar-profile-btn"
              onClick={onOpenProfile}
              title="Profil czasu"
            >
              ⏱
            </button>
          )}
          <div class="calendar-view-toggle">
            <button
              type="button"
              class={`calendar-view-btn${
                viewMode.value === "month" ? " calendar-view-btn--active" : ""
              }`}
              onClick={() => {
                viewMode.value = "month";
              }}
            >
              Miesiąc
            </button>
            <button
              type="button"
              class={`calendar-view-btn${
                viewMode.value === "week" ? " calendar-view-btn--active" : ""
              }`}
              onClick={() => {
                viewMode.value = "week";
              }}
            >
              Tydzień
            </button>
          </div>
        </div>
      </header>

      <div class="calendar-nav">
        <button type="button" class="calendar-nav-btn" onClick={prev}>‹</button>
        <span class="calendar-nav-label">{monthLabel}</span>
        <button type="button" class="calendar-nav-btn" onClick={next}>›</button>
      </div>

      {error.value && <p class="calendar-error">{error.value}</p>}
      {loading.value && <p class="calendar-loading">Ładowanie…</p>}

      {!loading.value && viewMode.value === "month" && (
        <div class="calendar-month">
          <div class="calendar-weekdays">
            {WEEKDAY_NAMES.map((d) => <span key={d} class="calendar-weekday">{d}</span>)}
          </div>
          <div class="calendar-grid">
            {monthGrid().map((cell, i) => {
              if (!cell.date) return <div key={i} class="calendar-cell calendar-cell--empty" />;
              const dayEvents = eventsOnDate(cell.date);
              const isToday = cell.date === today;
              const isSelected = cell.date === selectedDate.value;
              return (
                <button
                  key={cell.date}
                  type="button"
                  class={`calendar-cell${isToday ? " calendar-cell--today" : ""}${
                    isSelected ? " calendar-cell--selected" : ""
                  }`}
                  onClick={() => {
                    selectedDate.value = cell.date!;
                  }}
                >
                  <span class="calendar-cell-day">{cell.day}</span>
                  {dayEvents.length > 0 && (
                    <span class="calendar-cell-dots">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          class="calendar-dot"
                          style={{ background: KIND_COLORS[e.kind] }}
                          title={e.title}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading.value && viewMode.value === "week" && (
        <div class="calendar-week">
          {weekDays.map((d) => {
            const key = dateKey(d);
            const dayEvents = eventsOnDate(key);
            const isToday = key === today;
            return (
              <div
                key={key}
                class={`calendar-week-col${isToday ? " calendar-week-col--today" : ""}`}
              >
                <button
                  type="button"
                  class="calendar-week-head"
                  onClick={() => {
                    selectedDate.value = key;
                  }}
                >
                  <span class="calendar-week-day">{WEEKDAY_NAMES[(d.getDay() + 6) % 7]}</span>
                  <span class="calendar-week-date">{d.getDate()}</span>
                </button>
                <ul class="calendar-week-events">
                  {dayEvents.length === 0 && <li class="calendar-week-empty">—</li>}
                  {dayEvents.map((e) => (
                    <li
                      key={e.id}
                      class="calendar-week-event"
                      style={{ borderLeftColor: KIND_COLORS[e.kind] }}
                    >
                      <span class="calendar-week-event-time">
                        {e.start.slice(11, 16)}
                      </span>
                      <span class="calendar-week-event-title">{e.title}</span>
                      <span class="calendar-week-event-kind">{KIND_LABELS[e.kind]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {!loading.value && (
        <section class="calendar-day-detail">
          <h3 class="calendar-day-title">
            {selectedDate.value}
            {selectedDate.value === today && " (dziś)"}
          </h3>
          <ul class="calendar-day-events">
            {eventsOnDate(selectedDate.value).length === 0 && (
              <li class="calendar-day-empty">Brak wydarzeń</li>
            )}
            {eventsOnDate(selectedDate.value).map((e) => (
              <li key={e.id} class="calendar-day-event">
                <span
                  class="calendar-day-event-badge"
                  style={{ background: KIND_COLORS[e.kind] }}
                >
                  {KIND_LABELS[e.kind]}
                </span>
                <span class="calendar-day-event-title">{e.title}</span>
                <span class="calendar-day-event-time">
                  {e.start.slice(11, 16)}
                  {e.end ? ` – ${e.end.slice(11, 16)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
