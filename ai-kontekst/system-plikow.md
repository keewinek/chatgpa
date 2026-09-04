# System plików — metafora OS

## North star: wszystko jest plikiem

ChatGPA dąży do tego, żeby **stan aplikacji był drzewem plików pod `~/`**. Panele UI (kalendarz,
TODO, notatki, plan lekcji, profil) to **widoki na pliki**, nie osobne silosy. Agent i uczeń mają
ten sam model mentalny: „żeby coś zmienić — edytuj plik” (`fs.read` / `fs.write` albo tool
domenowy, który i tak zapisuje plik).

Konsekwencje:

1. Nowe funkcje najpierw projektuj jako **format pliku + katalog**, potem UI i tools.
2. Pliki `*.ui` to zwykłe pliki w tym samym drzewie (np. `~/calendar/calendar.ui`) — otwierają
   panel; **nie ma osobnej warstwy „aplikacje” vs „dane”**.
3. Preferencje (grupy lekcyjne, profil czasu) też są plikami (`~/school/groups.json`,
   `~/profile/me.profile`), nie tylko `localStorage`.
4. Agent w prompcie systemowym eksploruje jedno `~/` zamiast zgadywać.

## Cel

ChatGPA to nie tylko chat — to **osobisty OS do szkoły**. Dane użytkownika (TODO, notatki, pamięć,
kalendarz, książki) żyją jako **pliki w katalogach** z rozpoznawalnymi rozszerzeniami. Użytkownik i
agent mają ten sam widok; agent operuje przez tools `fs.*` oraz skróty domenowe.

## Zasady

1. **Serwer = źródło prawdy** — pliki w DB / object storage, nie tylko na dysku klienta.
2. **Wirtualny root** — `~` lub `/home` w UI; fizycznie prefix `user/{userId}/`.
3. **Rozszerzenia** oznaczają typ — parser wie jak renderować / edytować.
4. **Katalogi** grupują domeny — nie jeden wielki JSON.
5. Agent **nie** dostaje pełnej listy plików w prompcie — `fs.list`, `fs.read`, `fs.write`.
6. **File-first** — UI i API są projekcją plików; unikaj stanu „tylko w pamięci procesu”.

## Drzewo katalogów (aktualne + docelowe)

```
~/
├── memory/
│   ├── long-term.memory
│   └── short-term.memory
├── todo/
│   ├── todo.ui
│   └── global.todo
├── notes/
│   ├── notes.ui
│   └── …/*.md
├── calendar/
│   ├── calendar.ui
│   └── YYYY-MM.cal
├── school/
│   ├── timetable.ui
│   ├── groups.json             # language, english, pe, informatics
│   ├── librus/
│   │   ├── grades.json
│   │   ├── schedule.json
│   │   └── timetable-changes.json
│   └── subjects/
│       └── *.subject
├── books/
├── plans/
│   └── YYYY-MM-DD.plan
├── profile/
│   ├── profile.ui
│   └── me.profile
└── pomodoro/
    └── pomodoro.ui
```

## Rozszerzenia plików

| Rozszerzenie   | Zawartość                                          | Edycja w UI               |
| -------------- | -------------------------------------------------- | ------------------------- |
| `.ui`          | Deskryptor widoku (`{ "view", "title" }`) — zwykły plik w drzewie | otwiera panel             |
| `.memory`      | JSONL wpisów pamięci                               | read-only + panel pamięci |
| `.todo`        | Markdown z checkboxami + metadane YAML frontmatter | edytor TODO               |
| `.md`          | Notatki Markdown                                   | edytor notatek            |
| `.cal`         | Wydarzenia miesiąca (JSON lub iCal subset)         | widok kalendarza          |
| `.plan`        | Plan dnia/tygodnia (Markdown + bloki czasu)        | widok planu               |
| `.profile`     | YAML/JSON profilu                                  | formularz ustawień        |
| `.subject`     | Meta przedmiotu (cel średniej, nauczyciel)         | formularz                 |
| `.json`        | Snapshoty (Librus), grupy lekcyjne                 | read / agent write        |
| `.pdf`, obrazy | Książki / materiały                                | podgląd + AI read         |

## Format `.todo` (przykład)

```markdown
---
updatedAt: 2026-09-02T18:00:00+02:00
---

# Globalna TODO

- [ ] Powtórka: kwasy — chemia — due: 2026-09-05 — 25min — priority: high
- [x] Zadanie z historii — done: 2026-09-01
```

Agent i API parsują do encji `Task` ([model-danych.md](./model-danych.md)).

## Format `.cal` (miesiąc)

```json
{
  "month": "2026-09",
  "events": [
    {
      "id": "...",
      "title": "Sprawdzian chemia",
      "kind": "exam",
      "start": "2026-09-12T08:00:00+02:00",
      "source": "librus"
    },
    {
      "title": "Blok nauki: funkcje",
      "kind": "study_block",
      "start": "2026-09-02T19:00:00+02:00",
      "end": "2026-09-02T19:25:00+02:00",
      "source": "ai"
    }
  ]
}
```

## Tools dla agenta (`fs.*`)

| Tool        | Opis                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| `fs.list`   | `{ path: string }` → lista plików/katalogów                            |
| `fs.read`   | `{ path: string, offset?, limit? }` → treść (tekst) lub meta (binarny) |
| `fs.write`  | `{ path, content, createOnly? }`                                       |
| `fs.append` | `{ path, content }` — np. dopisanie do `.memory`                       |
| `fs.mkdir`  | `{ path }`                                                             |
| `fs.delete` | `{ path }` — z potwierdzeniem dla ważnych plików                       |
| `fs.search` | `{ query, path?, glob? }` — grep po notatkach/książkach (tekst)        |

Dla PDF/książek: `fs.read` zwraca wyciągnięty tekst (jak obecny pipeline załączników).

Tools domenowe (`todo.*`, `calendar.*`, `notes.*`, `timetable.*`, `memory.*`) są **skrótami** do
operacji na tych plikach / tabelach zsynchronizowanych z FS — agent może też iść „na surowo” przez
`fs.*`.

## API (HTTP)

| Method | Path                    | Opis                    |
| ------ | ----------------------- | ----------------------- |
| GET    | `/api/fs?path=~`        | list                    |
| GET    | `/api/fs/file?path=...` | read                    |
| PUT    | `/api/fs/file`          | write                   |
| POST   | `/api/fs/mkdir`         | mkdir                   |
| DELETE | `/api/fs/file?path=...` | delete                  |
| POST   | `/api/fs/upload`        | upload do `books/` itd. |

## UI

- Jedno drzewo plików (bez trybu „apps / dane”) — resizable, chowa się po otwarciu `.ui`
- Otwarcie `.ui` renderuje panel; otwarcie innych plików — podgląd / edytor
- Komenda `/files` i ikona folderu otwierają panel

## Bezpieczeństwo

- Ścieżki sanityzowane — brak `../` poza root użytkownika
- Jeden user (single-user) — na start bez auth, potem prosty token
- Backup: eksport całego `~/` jako zip (nice-to-have)

## Definition of Done

- [x] Wirtualny FS w API + DB
- [x] Min. katalogi: `memory/`, `todo/`, `notes/`, `calendar/`, `books/`, `school/`, `profile/`
- [x] Tools `fs.list`, `fs.read`, `fs.write`
- [x] UI jednego drzewa plików + pliki `.ui` jako widoki
- [x] Globalna TODO jako `~/todo/…`
- [ ] Pełna zbieżność: każdy panel domenowy = wyłącznie projekcja plików (bez ukrytego stanu)
- [ ] `fs.append` / `fs.search` / eksport `~/` zip
