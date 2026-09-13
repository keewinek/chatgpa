# System plików — metafora OS (jak Cursor)

## North star: szkoła = jeden codebase

ChatGPA traktuje szkołę ucznia jak **repozytorium plików pod `~/`**. Agent i uczeń widzą to samo
drzewo. Zmiana stanu = edycja pliku (`fs.read` / `fs.write` / `fs.mkdir` / `fs.delete`) — jak w
Cursorze / Claude Code, **bez miliona narzędzi domenowych w context window**.

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
├── pomodoro/                     # katalog (panel przez /pomodoro, bez .ui)
└── dev/
    └── dla-claude-code.md        # samodoskonalenie — patrz sekcja niżej
```

## Rozszerzenia plików

| Rozszerzenie | Zawartość                  | UI                                 |
| ------------ | -------------------------- | ---------------------------------- |
| `.ui`        | `{ "view", "title" }`      | panel (tylko calendar / timetable) |
| `.memory`    | JSONL pamięci              | edytor pliku + import do indeksu   |
| `.todo`      | Markdown checkboxy         | edytor pliku / panel `/todo`       |
| `.md`        | Notatki                    | edytor / panel `/notes`            |
| `.cal`       | Wydarzenia miesiąca (JSON) | panel kalendarza                   |
| `.plan`      | Plan dnia                  | edytor                             |
| `.profile`   | Profil czasu               | panel `/profile`                   |
| `.json`      | Snapshoty Librus, grupy    | edytor                             |

## Tools agenta (runtime)

**Dokumentowane w system prompt** (jedyny kontrakt dla modelu):

| Tool                 | Rola                                                         |
| -------------------- | ------------------------------------------------------------ |
| `fs.list`            | lista katalogu                                               |
| `fs.read`            | treść pliku                                                  |
| `fs.grep`            | pełnotekstowe wyszukiwanie po `~/` (opcjonalnie path, limit) |
| `fs.write`           | utwórz / nadpisz (w tym puste pliki)                         |
| `fs.mkdir`           | katalog                                                      |
| `fs.delete`          | usuń plik / pusty katalog                                    |
| `plan.generate`      | plan nauki na dzień (zapisuje `.plan` + bloki)               |
| `calendar.freeSlots` | wolne okna                                                   |
| `web.search`         | internet                                                     |
| `calc.eval`          | kalkulator                                                   |
| `file.send`          | plik do pobrania                                             |

Handlery legacy (`todo.*`, `notes.*`, …) mogą istnieć w kodzie dla kompatybilności testów / API, ale
**nie są reklamowane agentowi** — unikamy zapychania context window.

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

## Samodoskonalenie (`~/dev/dla-claude-code.md`)

ChatGPA (agent w apce) nie zmienia własnego kodu. Zamiast tego dopisuje do
`~/dev/dla-claude-code.md` gotowe do wklejenia prompty inżynierskie dla **Claude Code** — patrz
[dla-agenta.md](./dla-agenta.md) i [decyzje.md](./decyzje.md) (2026-09-13, „Samodoskonalenie”).
Uczeń kopiuje wpis stamtąd do Claude Code w repo. Zawsze append (fs.read + fs.write całości), nigdy
nadpisanie — historia wpisów ma zostać.

**Claude Code ↔ wirtualny FS:** ten sam Postgres, te same ścieżki `~/…`, co widzi apka i agent w
czacie — most to `scripts/fs-cli.ts` (`deno task fs list|read|write|grep|mkdir|delete`). Claude Code
może więc czytać `~/dev/dla-claude-code.md` (i każdy inny plik) bez odpalania `deno task dev`, np.:

```bash
deno task fs read ~/dev/dla-claude-code.md
```

## Diff + undo (`fs.write`, epik 15)

Każdy `fs.write`, który **nadpisuje** istniejący plik (nie: tworzenie nowego, nie: reanimacja
usuniętego), robi dwie rzeczy więcej:

1. **Diff w wyniku narzędzia** — `fsWrite` zwraca `diff: string | null` (prosty tekst `+`/`-` per
   linia, licznik `+N -M`, ucięty przy dużych zmianach). Widoczny w dymku narzędzia w czacie i w
   panelu Plików (blok nad edytorem po Save).
2. **Wersja poprzedniej treści** — tabela `file_versions` (`packages/api/db/schema.ts`), max 5
   ostatnich wersji na ścieżkę, kolejność po `seq` (nie po `created_at` — kilka zapisów w tej samej
   milisekundzie miałoby niejednoznaczną kolejność). Bez zmiany treści → brak nowej wersji (no-op
   save nie zaśmieca historii).

**Cofnij:** przycisk „Cofnij” w panelu Plików (aktywny gdy `versionCount > 0`) woła
`POST /api/fs/file/restore` — przywraca najnowszą wersję, a **bieżącą** treść odkłada jako nową
wersję, więc cofnięcie samo jest odwracalne (ponowne „Cofnij” = redo). `GET /api/fs/file/history`
zwraca listę wersji (id, data, podgląd) do UI.

Funkcje: `computeLineDiff`, `formatDiffSummary`, `fsHistory`, `fsRestore` w `fs/service.ts`. **Nie**
są to narzędzia agenta w system prompcie — to bezpiecznik dla człowieka w panelu Plików, zgodnie z
minimalnym zestawem `fs.*` dla modelu (agent i tak dostaje diff automatycznie w wyniku `fs.write`).

## Definition of Done

- [x] Wirtualny FS w API + DB
- [x] Seed katalogów + tylko `calendar.ui` / `timetable.ui`
- [x] Tools `fs.list|read|write|mkdir|delete|grep` w prompcie
- [x] UI: drzewo + edytor + tworzenie plików/katalogów
- [x] TODO / memory jako SoT plików
- [x] `fs.grep` — pełnotekstowe wyszukiwanie po `~/`
- [x] Samodoskonalenie: `~/dev/dla-claude-code.md` + `scripts/fs-cli.ts` most dla Claude Code
- [x] Diff + undo przy `fs.write` (`file_versions`, panel Plików „Cofnij”)
- [ ] Pełna zbieżność: każdy panel = wyłącznie projekcja plików
- [ ] Eksport `~/` zip
