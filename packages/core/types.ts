export type ChatRole = "system" | "user" | "assistant";

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
}

export type MemoryKind = "short" | "long";
export type MemorySource = "ai" | "user" | "system";

export interface MemoryEntry {
  id: string;
  content: string;
  kind: MemoryKind;
  createdAt: string;
  expiresAt?: string;
  source: MemorySource;
  tags?: string[];
  chatId?: string;
}

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "done" | "cancelled";
export type TaskSource = "manual" | "librus" | "ai" | "plan";

export interface Task {
  id: string;
  title: string;
  subjectId?: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedMinutes?: number;
  source: TaskSource;
  roiScore?: number;
  scheduledFor?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
