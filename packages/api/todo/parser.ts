import type { Task, TaskPriority, TaskSource, TaskStatus } from "@chatgpa/core";

const CHECKBOX_RE = /^-\s+\[([ xX])\]\s+(.+)$/;
const META_SEP = " — ";

export function newTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseMetaSegment(segment: string): [string, string] | null {
  const idx = segment.indexOf(":");
  if (idx <= 0) return null;
  const key = segment.slice(0, idx).trim().toLowerCase();
  const value = segment.slice(idx + 1).trim();
  return value ? [key, value] : null;
}

function parseMinutes(value: string): number | undefined {
  const match = value.match(/^(\d+)\s*min$/i);
  if (!match) return undefined;
  return Number(match[1]);
}

function parsePriority(value: string): TaskPriority | undefined {
  const v = value.toLowerCase();
  if (v === "low" || v === "medium" || v === "high") return v;
  return undefined;
}

function parseStatus(value: string): TaskStatus | undefined {
  const v = value.toLowerCase();
  if (v === "open" || v === "done" || v === "cancelled") return v;
  return undefined;
}

function parseSource(value: string): TaskSource | undefined {
  const v = value.toLowerCase();
  if (v === "manual" || v === "librus" || v === "ai" || v === "plan") return v;
  return undefined;
}

function parseLine(line: string): Task | null {
  const match = line.match(CHECKBOX_RE);
  if (!match) return null;

  const checked = match[1].toLowerCase() === "x";
  const rest = match[2].trim();
  const parts = rest.split(META_SEP);
  const title = parts[0]?.trim();
  if (!title) return null;

  let id = newTaskId();
  let dueDate: string | undefined;
  let priority: TaskPriority = "medium";
  let status: TaskStatus = checked ? "done" : "open";
  let estimatedMinutes: number | undefined;
  let subjectId: string | undefined;
  let source: TaskSource = "manual";
  let roiScore: number | undefined;
  let scheduledFor: string | undefined;
  let notes: string | undefined;

  for (const segment of parts.slice(1)) {
    const parsed = parseMetaSegment(segment);
    if (!parsed) {
      const mins = parseMinutes(segment);
      if (mins !== undefined) {
        estimatedMinutes = mins;
      } else if (!subjectId && segment.trim()) {
        subjectId = segment.trim();
      }
      continue;
    }
    const [key, value] = parsed;

    switch (key) {
      case "id":
        id = value;
        break;
      case "due":
        dueDate = value;
        break;
      case "priority":
        priority = parsePriority(value) ?? priority;
        break;
      case "status":
        status = parseStatus(value) ?? status;
        break;
      case "subject":
      case "subjectid":
        subjectId = value;
        break;
      case "source":
        source = parseSource(value) ?? source;
        break;
      case "roi":
      case "roiscore":
        roiScore = Number(value);
        break;
      case "scheduled":
      case "scheduledfor":
        scheduledFor = value;
        break;
      case "notes":
        notes = value;
        break;
      default: {
        const mins = parseMinutes(key === "min" ? value : segment);
        if (mins !== undefined) estimatedMinutes = mins;
        else if (key.endsWith("min")) {
          const n = Number(key.replace(/min$/, ""));
          if (Number.isFinite(n)) estimatedMinutes = n;
        }
        break;
      }
    }

    const minsFromValue = parseMinutes(value);
    if (minsFromValue !== undefined) estimatedMinutes = minsFromValue;
  }

  if (checked && status === "open") status = "done";

  return {
    id,
    title,
    subjectId,
    dueDate,
    priority,
    status,
    estimatedMinutes,
    source,
    roiScore: Number.isFinite(roiScore) ? roiScore : undefined,
    scheduledFor,
    notes,
  };
}

export function parseTodoFile(content: string): { updatedAt?: string; tasks: Task[] } {
  const lines = content.split("\n");
  let updatedAt: string | undefined;
  let inFrontmatter = false;
  let frontmatterDone = false;
  const tasks: Task[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!frontmatterDone && line === "---") {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) frontmatterDone = true;
      continue;
    }

    if (inFrontmatter) {
      const match = line.match(/^updatedAt:\s*(.+)$/i);
      if (match) updatedAt = match[1].trim();
      continue;
    }

    const task = parseLine(line.trim());
    if (task) tasks.push(task);
  }

  return { updatedAt, tasks };
}

function formatMeta(key: string, value: string | number): string {
  return `${key}: ${value}`;
}

function formatLine(task: Task): string {
  const checked = task.status === "done" ? "x" : " ";
  const meta: string[] = [formatMeta("id", task.id)];

  if (task.dueDate) meta.push(formatMeta("due", task.dueDate));
  if (task.estimatedMinutes) meta.push(`${task.estimatedMinutes}min`);
  if (task.priority !== "medium") meta.push(formatMeta("priority", task.priority));
  if (task.subjectId) meta.push(formatMeta("subject", task.subjectId));
  if (task.source !== "manual") meta.push(formatMeta("source", task.source));
  if (task.status !== "open" && task.status !== "done") {
    meta.push(formatMeta("status", task.status));
  }
  if (task.roiScore !== undefined) meta.push(formatMeta("roi", task.roiScore));
  if (task.scheduledFor) meta.push(formatMeta("scheduled", task.scheduledFor));
  if (task.notes) meta.push(formatMeta("notes", task.notes));
  if (task.status === "done" && task.updatedAt) {
    meta.push(formatMeta("done", task.updatedAt.slice(0, 10)));
  }

  return `- [${checked}] ${task.title}${META_SEP}${meta.join(META_SEP)}`;
}

export function serializeTodoFile(tasks: Task[], updatedAt = new Date().toISOString()): string {
  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");
  const other = tasks.filter((t) => t.status === "cancelled");

  const sections: string[] = [
    "---",
    `updatedAt: ${updatedAt}`,
    "---",
    "",
    "# Globalna TODO",
    "",
  ];

  if (open.length) {
    sections.push("## Otwarte", "");
    sections.push(...open.map(formatLine), "");
  }

  if (done.length) {
    sections.push("## Zrobione", "");
    sections.push(...done.map(formatLine), "");
  }

  if (other.length) {
    sections.push("## Anulowane", "");
    sections.push(...other.map(formatLine), "");
  }

  if (!open.length && !done.length && !other.length) {
    sections.push("_Brak zadań._", "");
  }

  return sections.join("\n");
}
