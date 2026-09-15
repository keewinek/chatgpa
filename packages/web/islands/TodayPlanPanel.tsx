import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { Task } from "@chatgpa/core";
import { completeTask, fetchTasks, formatDueDate, priorityLabel } from "../lib/todo-api.ts";
import Icon from "./Icon.tsx";

interface TodayPlanPanelProps {
  loading: boolean;
  onBack: () => void;
  onAskAgent: (text: string) => void;
}

export default function TodayPlanPanel({ loading, onBack, onAskAgent }: TodayPlanPanelProps) {
  const tasksLoading = useSignal(true);
  const error = useSignal<string | null>(null);
  const tasks = useSignal<Task[]>([]);
  const askText = useSignal("");

  async function load() {
    tasksLoading.value = true;
    error.value = null;
    try {
      tasks.value = await fetchTasks("today");
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      tasks.value = [];
    } finally {
      tasksLoading.value = false;
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleToggle(id: string) {
    const updated = await completeTask(id);
    if (!updated) {
      error.value = "Nie udało się oznaczyć zadania";
      return;
    }
    await load();
  }

  function submitAsk(e: Event) {
    e.preventDefault();
    const text = askText.value.trim();
    if (!text || loading) return;
    askText.value = "";
    onAskAgent(text);
  }

  return (
    <div class="today-plan">
      <header class="todo-header">
        <button type="button" class="todo-back" onClick={onBack}>
          <Icon name="arrow-left" /> Czat
        </button>
        <div class="todo-header-text">
          <h2 class="todo-title">Plan dzisiejszy</h2>
          <p class="todo-subtitle">Rzeczy do zrobienia dziś</p>
        </div>
        <button
          type="button"
          class="todo-refresh"
          onClick={() => void load()}
          disabled={tasksLoading.value}
        >
          Odśwież
        </button>
      </header>

      {error.value && <p class="todo-error">{error.value}</p>}

      <div class="todo-list-wrap">
        {tasksLoading.value && tasks.value.length === 0
          ? <p class="todo-empty">Ładowanie…</p>
          : tasks.value.length === 0
          ? <p class="todo-empty">Nic do zrobienia na dziś.</p>
          : (
            <ul class="todo-list">
              {tasks.value.map((task) => (
                <li key={task.id} class={`todo-item todo-item--${task.status}`}>
                  <label class="todo-item-check">
                    <input
                      type="checkbox"
                      checked={task.status === "done"}
                      disabled={task.status === "done"}
                      onChange={() =>
                        void handleToggle(task.id)}
                    />
                    <span class="todo-item-title">{task.title}</span>
                  </label>
                  <div class="todo-item-meta">
                    {task.dueDate && (
                      <span class="todo-item-due">{formatDueDate(task.dueDate)}</span>
                    )}
                    {task.estimatedMinutes && (
                      <span class="todo-item-mins">{task.estimatedMinutes} min</span>
                    )}
                    {task.priority !== "medium" && (
                      <span class={`todo-item-priority todo-item-priority--${task.priority}`}>
                        {priorityLabel(task.priority)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>

      <form class="mini-agent" onSubmit={submitAsk}>
        <input
          type="text"
          class="mini-agent-input"
          placeholder="Zapytaj agenta…"
          value={askText.value}
          disabled={loading}
          onInput={(e) => {
            askText.value = (e.target as HTMLInputElement).value;
          }}
        />
        <button
          type="submit"
          class="mini-agent-send"
          disabled={loading || !askText.value.trim()}
          aria-label="Wyślij"
          title="Wyślij"
        >
          <Icon name={loading ? "spinner" : "arrow-up"} class={loading ? "fa-spin" : undefined} />
        </button>
      </form>
    </div>
  );
}
