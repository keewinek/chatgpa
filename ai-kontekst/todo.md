# System TODO — globalna lista zadań

## Cel

Jedna **globalna lista rzeczy do zrobienia** — widoczna dla użytkownika i w pełni zarządzana przez agenta.
Źródło prawdy: plik `~/todo/global.todo` + sync na serwerze ([system-plikow.md](./system-plikow.md)).

## Wymagania użytkownika

- Agent może: **czytać**, **dodawać**, **edytować**, **oznaczać jako done**, **usuwać**
- Lista jest **globalna** — nie per-czat; dotyczy całego życia szkolnego
- Powiązanie z planem dnia i powiadomieniami ([plan-nauki.md](./plan-nauki.md))
- Widoczna po kliknięciu powiadomienia „co na dziś”

## Model (encja Task)

Zgodnie z [model-danych.md](./model-danych.md):

```ts
{
  id: string
  title: string
  subjectId?: string
  dueDate?: string          // ISO date
  priority: "low" | "medium" | "high"
  status: "open" | "done" | "cancelled"
  estimatedMinutes?: number
  source: "manual" | "librus" | "ai" | "plan"
  roiScore?: number
  scheduledFor?: string     // na który dzień zaplanowano (plan dzienny)
  notes?: string
}
```

## Źródła zadań

| Źródło | Przykład |
| ------ | -------- |
| `manual` | Użytkownik lub `/todo add ...` |
| `librus` | Praca domowa ze syncu |
| `ai` | Agent po rozmowie („dodaj powtórkę na środę”) |
| `plan` | Automatyczny plan dzienny / tygodniowy |

## Tools dla agenta

| Tool | Opis |
| ---- | ---- |
| `todo.list` | `{ status?, dueBefore?, scheduledFor? }` |
| `todo.add` | `{ title, ... }` |
| `todo.update` | `{ id, ... }` |
| `todo.complete` | `{ id }` |
| `todo.delete` | `{ id }` |

Alternatywa: operacje przez `fs.read` / `fs.write` na `global.todo` — **preferuj dedykowane tools** (mniej błędów parsowania).

## UI

- Panel boczny lub `/todo`
- Filtry: dziś / tydzień / wszystkie / done
- Sort: priority, due date, ROI
- Checkbox → `todo.complete`
- Integracja z planem dnia: sekcja „Na dziś” w powiadomieniu

## Przepływ z powiadomieniem

1. Agent generuje plan → tworzy `Task` z `scheduledFor: dziś` i `source: plan`
2. Powiadomienie: lista „Na dziś” + wiadomość agenta
3. Użytkownik: „dziś nie mogę” → agent `todo.update` (przeniesienie) + wpis w kalendarzu + short memory

## Definition of Done

- [x] `~/todo/global.todo` + API CRUD
- [x] Tools `todo.*` dla agenta
- [x] Panel UI + `/todo`
- [ ] Sync między urządzeniami
- [ ] Integracja z planem dnia
