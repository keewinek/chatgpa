/** A single grade entry synced from Librus. */
export interface Grade {
  subjectId: string;
  subjectName: string;
  value: number;
  weight: number;
  category: string;
  date: string;
}

/** Subject metadata with target average tracking. */
export interface Subject {
  id: string;
  name: string;
  currentAverage: number;
  targetAverage: number;
}

/** Priority-ranked study task derived from ROI calculations. */
export interface TaskPriority {
  id: string;
  subjectId: string;
  title: string;
  dueDate: string;
  weight: number;
  roiScore: number;
}
