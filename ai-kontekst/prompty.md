# Prompty i lazy context

## Model (Cursor / Claude Code)

Agent nie dostaje całego stanu szkoły w system prompcie. Dostaje:

1. Krótki prompt: **szkoła = codebase `~/`**
2. Datę/czas (Warszawa) + plan lekcji dnia (wstrzyknięte)
3. Tools: głównie **`fs.*`** (+ `plan.generate`, `calendar.freeSlots`, `web.search`, …)

Źródło implementacji: `packages/api/ai/system-prompt.ts`.

## Zasady

- Wiedza ogólna (mitoza, wzory) → bez tools.
- Stan ucznia (TODO, pamięć, oceny, kalendarz) → `fs.read` właściwego pliku.
- Zmiana stanu → `fs.write` (lub `plan.generate` dla planu dnia).
- Aktualne fakty z sieci → `web.search`.

## Mapowanie danych → pliki

| Potrzeba              | Akcja agenta                                      |
| --------------------- | ------------------------------------------------- |
| TODO                  | `fs.read` / `fs.write` `~/todo/global.todo`       |
| Pamięć długa          | `~/memory/long-term.memory` (JSONL)               |
| Notatki               | `~/notes/**/*.md`                                 |
| Kalendarz             | `~/calendar/YYYY-MM.cal`                          |
| Oceny Librus          | `~/school/librus/grades.json`                     |
| Grupy lekcyjne        | `~/school/groups.json`                            |
| Profil czasu          | `~/profile/me.profile`                            |
| Plan nauki na dziś    | **`plan.generate`** (nie składaj ręcznie)         |
| Wolne okna            | `calendar.freeSlots`                              |

## Tools w prompcie (kontrakt)

Tylko te nazwy są dokumentowane dla modelu — celowo mało, żeby nie puchł context:

`fs.list`, `fs.read`, `fs.write`, `fs.mkdir`, `fs.delete`, `plan.generate`,
`calendar.freeSlots`, `web.search`, `calc.eval`, `file.send`.

## Checklist testów

1. Pytanie o TODO → agent woła `fs.read` na `global.todo`, nie zmyśla.
2. „Zapamiętaj, że…” → dopisuje do `long-term.memory` przez `fs.write`.
3. Pytanie ogólne → bez zbędnych tools.
4. Plan na dziś → `plan.generate`.
