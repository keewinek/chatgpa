import type { Task } from "@chatgpa/core";

const API = "";

export type TodoFilter = "all" | "open" | "done" | "today" | "week";

export async function fetchTasks(filter: TodoFilter = "all"): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filter === "open" || filter === "done") {
    params.set("status", filter);
  }
  if (filter === "today") {
    params.set("status", "open");
    params.set("dueBefore", todayIso());
  }
  if (filter === "week") {
    params.set("status", "open");
    params.set("dueBefore", weekEndIso());
  }

  const qs = params.toString();
  const res = await fetch(`${API}/api/todos${qs ? `?${qs}` : ""}`);
  if (!res.ok) return [];
  const data = await res.json() as { tasks?: Task[] };
  let tasks = Array.isArray(data.tasks) ? data.tasks : [];

  if (filter === "today") {
    const today = todayIso();
    tasks = tasks.filter((t) => !t.dueDate || t.dueDate <= today);
  }

  return tasks;
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

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function weekEndIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
