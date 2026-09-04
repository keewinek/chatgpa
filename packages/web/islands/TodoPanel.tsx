import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { Task } from "@chatgpa/core";
import {
  completeTask,
  createTask,
  deleteTask,
  fetchTasks,
  formatDueDate,
  priorityLabel,
  type TodoFilter,
} from "../lib/todo-api.ts";

interface TodoPanelProps {
  onBack: () => void;
  embedded?: boolean;
}

const FILTERS: { id: TodoFilter; label: string }[] = [
  { id: "today", label: "Dziś" },
  { id: "week", label: "Tydzień" },
  { id: "open", label: "Otwarte" },
  { id: "done", label: "Zrobione" },
  { id: "all", label: "Wszystkie" },
];

export default function TodoPanel({ onBack, embedded = false }: TodoPanelProps) {
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const tasks = useSignal<Task[]>([]);
  const filter = useSignal<TodoFilter>("open");
  const newTitle = useSignal("");
  const adding = useSignal(false);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      tasks.value = await fetchTasks(filter.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      tasks.value = [];
    } finally {
      loading.value = false;
    }
  }

  useEffect(() => {
    void load();
  }, [filter.value]);

  async function handleComplete(id: string) {
    const updated = await completeTask(id);
    if (!updated) {
      error.value = "Nie udało się oznaczyć zadania";
      return;
    }
    await load();
  }

  async function handleDelete(id: string) {
    const ok = await deleteTask(id);
    if (!ok) {
      error.value = "Nie udało się usunąć zadania";
      return;
    }
    await load();
  }

  async function handleAdd(e: Event) {
    e.preventDefault();
    const title = newTitle.value.trim();
    if (!title || adding.value) return;
    adding.value = true;
    error.value = null;
    try {
      const task = await createTask({ title });
      if (!task) {
        error.value = "Nie udało się dodać zadania";
        return;
      }
      newTitle.value = "";
      await load();
    } finally {
      adding.value = false;
    }
  }

  return (
    <div class={`todo-panel${embedded ? " todo-panel--embedded" : ""}`}>
      <header class="todo-header">
        {!embedded && (
          <button type="button" class="todo-back" onClick={onBack}>
            ← Czat
          </button>
        )}
        <div class="todo-header-text">
          <h2 class="todo-title">TODO</h2>
          <p class="todo-subtitle">~/todo/global.todo</p>
        </div>
        <button
          type="button"
          class="todo-refresh"
          onClick={() => void load()}
          disabled={loading.value}
        >
          Odśwież
        </button>
      </header>

      <div class="todo-filters" role="tablist" aria-label="Filtry TODO">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter.value === f.id}
            class={`todo-filter${filter.value === f.id ? " todo-filter--active" : ""}`}
            onClick={() => {
              filter.value = f.id;
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error.value && <p class="todo-error">{error.value}</p>}

      <form class="todo-add" onSubmit={(e) => void handleAdd(e)}>
        <input
          type="text"
          class="todo-add-input"
          placeholder="Nowe zadanie…"
          value={newTitle.value}
          disabled={adding.value}
          onInput={(e) => {
            newTitle.value = (e.target as HTMLInputElement).value;
          }}
        />
        <button
          type="submit"
          class="todo-add-btn"
          disabled={adding.value || !newTitle.value.trim()}
        >
          Dodaj
        </button>
      </form>

      <div class="todo-list-wrap">
        {loading.value && tasks.value.length === 0
          ? <p class="todo-empty">Ładowanie…</p>
          : tasks.value.length === 0
          ? <p class="todo-empty">Brak zadań w tym filtrze.</p>
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
                        void handleComplete(task.id)}
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
                    {task.subjectId && <span class="todo-item-subject">{task.subjectId}</span>}
                  </div>
                  <button
                    type="button"
                    class="todo-item-delete"
                    title="Usuń"
                    aria-label="Usuń zadanie"
                    onClick={() => void handleDelete(task.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
