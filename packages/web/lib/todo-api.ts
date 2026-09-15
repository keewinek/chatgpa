import { getWarsawNow } from "@chatgpa/core";
import type { Task } from "@chatgpa/core";

const API = "";

export type TodoFilter = "all" | "open" | "done" | "today" | "week";

async function fetchByParams(params: URLSearchParams): Promise<Task[]> {
  const qs = params.toString();
  const res = await fetch(`${API}/api/todos${qs ? `?${qs}` : ""}`);
  if (!res.ok) return [];
  const data = await res.json() as { tasks?: Task[] };
  return Array.isArray(data.tasks) ? data.tasks : [];
}

function dedupeById(tasks: Task[]): Task[] {
  const byId = new Map<string, Task>();
  for (const task of tasks) byId.set(task.id, task);
  return [...byId.values()];
}

export async function fetchTasks(filter: TodoFilter = "all"): Promise<Task[]> {
  if (filter === "today") {
    // "Dziś" = zadania zaplanowane przez Plan dnia na dziś (scheduledFor) *lub*
    // z terminem dziś/zaległym (dueDate) — Plan może przypisać dziś zadanie, którego
    // dueDate jest odległe (np. nauka do sprawdzianu za 5 dni), więc nie wystarczy dueDate.
    const today = todayIso();
    const [byDue, byScheduled] = await Promise.all([
      fetchByParams(new URLSearchParams({ status: "open", dueBefore: today })),
      fetchByParams(new URLSearchParams({ status: "open", scheduledFor: today })),
    ]);
    return dedupeById([...byDue, ...byScheduled]);
  }

  const params = new URLSearchParams();
  if (filter === "open" || filter === "done") {
    params.set("status", filter);
  }
  if (filter === "week") {
    params.set("status", "open");
    params.set("dueBefore", weekEndIso());
  }

  return await fetchByParams(params);
}

export async function createTask(input: {
  title: string;
  dueDate?: string;
  priority?: Task["priority"];
  estimatedMinutes?: number;
}): Promise<Task | null> {
  const res = await fetch(`${API}/api/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  const data = await res.json() as { task?: Task };
  return data.task ?? null;
}

export async function completeTask(id: string): Promise<Task | null> {
  const res = await fetch(`${API}/api/todos/${encodeURIComponent(id)}/complete`, {
    method: "POST",
  });
  if (!res.ok) return null;
  const data = await res.json() as { task?: Task };
  return data.task ?? null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const res = await fetch(`${API}/api/todos/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return res.ok;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "dueDate" | "priority" | "status" | "estimatedMinutes">>,
): Promise<Task | null> {
  const res = await fetch(`${API}/api/todos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const data = await res.json() as { task?: Task };
  return data.task ?? null;
}

export function priorityLabel(priority: Task["priority"]): string {
  if (priority === "high") return "Wysoki";
  if (priority === "low") return "Niski";
  return "Średni";
}

export function formatDueDate(dueDate?: string): string | null {
  if (!dueDate) return null;
  const date = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  return date.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${
    String(date.getDate()).padStart(2, "0")
  }`;
}

function todayIso(): string {
  return dateKey(getWarsawNow());
}

function weekEndIso(): string {
  const d = getWarsawNow();
  d.setDate(d.getDate() + 7);
  return dateKey(d);
}
