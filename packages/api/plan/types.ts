import type { Task } from "@chatgpa/core";

export interface PlanBlock {
  start: string;
  end: string;
  minutes: number;
  title: string;
  subjectId?: string;
  taskId?: string;
  examDate?: string;
  daysUntilExam?: number;
  alertKind?: "t7" | "t3" | "t1";
}

export interface DailyPlanResult {
  date: string;
  weekdayLabel: string;
  budgetMinutes: number;
  usedMinutes: number;
  blocks: PlanBlock[];
  tasks: Task[];
  message: string;
  notes: string[];
  examAlerts: ExamAlert[];
  planFilePath: string;
  aiUsed: boolean;
}

export interface ExamAlert {
  kind: "t7" | "t3" | "t1";
  examDate: string;
  title: string;
  subjectId?: string;
  daysUntil: number;
}

export interface ExamPrepItem {
  examId: string;
  title: string;
  subjectId?: string;
  examDate: string;
  totalMinutes: number;
  roiScore: number;
}

export interface DayStudyItem {
  key: string;
  title: string;
  subjectId?: string;
  minutes: number;
  priority: number;
  examDate?: string;
  daysUntilExam?: number;
  alertKind?: "t7" | "t3" | "t1";
  taskId?: string;
  source: "exam" | "task";
}

export interface AiPlanResponse {
  message: string;
  notes?: string[];
}
