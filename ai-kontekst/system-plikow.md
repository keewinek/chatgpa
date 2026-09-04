# System plików — metafora OS (jak Cursor)

## North star: szkoła = jeden codebase

ChatGPA traktuje szkołę ucznia jak **repozytorium plików pod `~/`**. Agent i uczeń widzą to
samo drzewo. Zmiana stanu = edycja pliku (`fs.read` / `fs.write` / `fs.mkdir` / `fs.delete`) —
jak w Cursorze / Claude Code, **bez miliona narzędzi domenowych w context window**.

Konsekwencje:

1. Nowe funkcje najpierw jako **format pliku + katalog**, potem opcjonalny panel UI.
2. Pliki `.ui` to **tylko launchery paneli bogatych** — obecnie wyłącznie kalendarz i plan lekcji.
   TODO, notatki, profil, pomodoro to zwykłe pliki / slash-komendy (bez osobnego `.ui`).
3. Preferencje też są plikami (`~/school/groups.json`, `~/profile/me.profile`).
4. Agent w prompcie dostaje **krótki zestaw tools** (`fs.*` + kilka helperów), nie `todo.*` /
   `notes.*` / `memory.*` / `grades.*`.

## Cel

Dane użytkownika żyją jako pliki z rozpoznawalnymi rozszerzeniami. UI paneli i tabele DB są
**projekcją / indeksem** plików — nie osobnymi silosami.

## Zasady

1. **Serwer = źródło prawdy** — pliki w DB, nie tylko na dysku klienta.
2. **Wirtualny root** — `~` w UI; fizycznie `user/{userId}/`.
3. **Rozszerzenia** oznaczają typ — parser wie jak renderować / importować.
4. **Katalogi** grupują domeny — nie jeden wielki JSON.
5. Agent **nie** dostaje pełnej listy plików w prompcie — `fs.list` / `fs.read` on demand.
6. **File-first** — unikaj stanu „tylko w pamięci procesu”.

## Drzewo katalogów

```
~/
├── memory/
│   └── long-term.memory          # JSONL — SoT pamięci długiej
├── todo/
│   └── global.todo               # Markdown checkboxy — SoT zadań
├── notes/
│   └── …/*.md
├── calendar/
│   ├── calendar.ui               # launcher panelu
│   └── YYYY-MM.cal
├── school/
│   ├── timetable.ui              # launcher panelu
│   ├── groups.json
│   └── librus/
│       ├── grades.json
│       ├── schedule.json
│       └── …
├── books/
├── plans/
│   └── YYYY-MM-DD.plan
├── profile/
│   └── me.profile
└── pomodoro/                     # katalog (panel przez /pomodoro, bez .ui)
```

## Rozszerzenia plików

| Rozszerzenie | Zawartość                            | UI                                      |
| ------------ | ------------------------------------ | --------------------------------------- |
| `.ui`        | `{ "view", "title" }`                | panel (tylko calendar / timetable)      |
| `.memory`    | JSONL pamięci                        | edytor pliku + import do indeksu        |
| `.todo`      | Markdown checkboxy                   | edytor pliku / panel `/todo`            |
| `.md`        | Notatki                              | edytor / panel `/notes`                 |
| `.cal`       | Wydarzenia miesiąca (JSON)           | panel kalendarza                        |
| `.plan`      | Plan dnia                            | edytor                                  |
| `.profile`   | Profil czasu                         | panel `/profile`                        |
| `.json`      | Snapshoty Librus, grupy              | edytor                                  |

## Tools agenta (runtime)

**Dokumentowane w system prompt** (jedyny kontrakt dla modelu):

| Tool               | Rola                                              |
| ------------------ | ------------------------------------------------- |
| `fs.list`          | lista katalogu                                    |
| `fs.read`          | treść pliku                                       |
| `fs.write`         | utwórz / nadpisz (w tym puste pliki)              |
| `fs.mkdir`         | katalog                                           |
| `fs.delete`        | usuń plik / pusty katalog                         |
| `plan.generate`    | plan nauki na dzień (zapisuje `.plan` + bloki)    |
| `calendar.freeSlots` | wolne okna                                      |
| `web.search`       | internet                                          |
| `calc.eval`        | kalkulator                                        |
| `file.send`        | plik do pobrania                                  |

Handlery legacy (`todo.*`, `notes.*`, …) mogą istnieć w kodzie dla kompatybilności testów / API,
ale **nie są reklamowane agentowi** — unikamy zapychania context window.

## API (HTTP)

| Method | Path                    | Opis   |
| ------ | ----------------------- | ------ |
| GET    | `/api/fs?path=~`        | list   |
| GET    | `/api/fs/file?path=...` | read   |
| PUT    | `/api/fs/file`          | write  |
| POST   | `/api/fs/mkdir`         | mkdir  |
| DELETE | `/api/fs/file?path=...` | delete |

## UI

- Jedno drzewo plików + edytor tekstu (Save / Cmd+S)
- **Nowy plik** / **Nowy katalog** w nagłówku panelu
- `.ui` (calendar, timetable) → panel; slash (`/todo`, `/notes`, …) otwiera panele bez `.ui`
- Komenda `/files` i ikona folderu

## Definition of Done

- [x] Wirtualny FS w API + DB
- [x] Seed katalogów + tylko `calendar.ui` / `timetable.ui`
- [x] Tools `fs.list|read|write|mkdir|delete` w prompcie
- [x] UI: drzewo + edytor + tworzenie plików/katalogów
- [x] TODO / memory jako SoT plików
- [ ] Pełna zbieżność: każdy panel = wyłącznie projekcja plików
- [ ] `fs.search` / eksport `~/` zip
