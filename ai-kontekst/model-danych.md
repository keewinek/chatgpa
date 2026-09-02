# Model danych

Docelowe encje (Faza 1+: typy w `@chatgpa/core`, potem tabele Drizzle). **Faza 0:** w core są tylko
`ChatMessage` / `ChatRole`.

## Profile (StudentProfile)

```ts
{
  id: string
  displayName: string
  className?: string          // np. "3A"
  targetOverallAverage: number // np. 4.75
  dailyStudyMinutes: number    // budżet dnia
  quietHours?: { start: string; end: string } // "21:00"–"07:00"
  weakSubjects?: string[]      // subjectId[]
  timezone: string             // "Europe/Warsaw"
  locale: "pl"
}
```

## Subject

```ts
{
  id: string
  name: string
  currentAverage: number
  targetAverage: number
  teacherName?: string
}
```

## Grade (z Librusa)

```ts
{
  id: string
  subjectId: string
  subjectName: string
  value: number          // 1–6 (+/− jako ułamek opcjonalnie później)
  weight: number
  category: string       // "sprawdzian", "kartkówka", …
  date: string           // ISO date
  comment?: string
}
```

## Task / TODO

```ts
{
  id: string
  title: string
  subjectId?: string
  dueDate?: string
  priority: "low" | "medium" | "high"
  roiScore?: number      // wyliczane
  source: "manual" | "librus" | "ai" | "plan"
  status: "open" | "done" | "cancelled"
  estimatedMinutes?: number
}
```

## CalendarEvent

```ts
{
  id: string
  title: string
  kind: "exam" | "homework" | "study_block" | "other"
  subjectId?: string
  start: string          // ISO datetime
  end?: string
  allDay?: boolean
  source: "manual" | "librus" | "ai"
}
```

## KnowledgeNode (tracker)

```ts
{
  id: string
  subjectId: string
  topic: string
  mastery: 0 | 1 | 2 | 3  // nie umiem → umiem
  lastReviewedAt?: string
  nextReviewAt?: string   // spaced repetition
  notes?: string
}
```

## ChatThread / ChatMessage

```ts
// Thread
{ id, title?, createdAt, updatedAt, mode?: "ask" | "plan" | "agent" | "focus" }

// Message
{ id, threadId, role: "system" | "user" | "assistant", content, model?, provider?, createdAt }
```

## LibrusSnapshot

```ts
{
  syncedAt: string
  grades: Grade[]
  exams: CalendarEvent[]
  homeworks: Task[]
  rawMeta?: Record<string, unknown>
}
```

## ROI (reguła robocza)

```
roiScore ≈ weight * (targetAverage - currentAverage) * urgency(dueDate) * (1 - mastery/3)
```

Im wyższy score, tym wcześniej w planie dnia / TODO.

## MemoryEntry (short / long)

```ts
{
  id: string
  content: string
  kind: "short" | "long"
  createdAt: string
  expiresAt?: string        // tylko short
  source: "ai" | "user" | "system"
  tags?: string[]
  chatId?: string
}
```

Szczegóły: [pamiec.md](./pamiec.md). Long-term odbicie: `~/memory/long-term.memory`.

## FileNode (wirtualny FS)

```ts
{
  id: string
  path: string              // np. ~/notes/chemia/kwasy.md
  kind: "file" | "directory"
  mimeType?: string
  content?: string          // tekst lub ref do blob
  updatedAt: string
}
```

Szczegóły: [system-plikow.md](./system-plikow.md).

## Notification

```ts
{
  id: string
  kind: "daily_plan" | "exam_alert" | "librus_update"
  title: string
  body: string
  chatPrefill?: { role: "assistant"; content: string }
  payload?: Record<string, unknown>  // todoToday, freeMinutes, ...
  createdAt: string
  readAt?: string
}
```

## Storage path

| Faza | Storage                                                            |
| ---- | ------------------------------------------------------------------ |
| 0    | localStorage (czat + memory string[])                              |
| 1    | localStorage (historia v2)                                         |
| 2    | PostgreSQL + wirtualny FS ([serwer-i-sync.md](./serwer-i-sync.md)) |
| 3+   | pgvector (RAG po książkach / notatkach)                            |
