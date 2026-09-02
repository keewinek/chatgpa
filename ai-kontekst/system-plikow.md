# System plików — metafora OS

## Cel

ChatGPA to nie tylko chat — to **osobisty OS do szkoły**. Dane użytkownika (TODO, notatki, pamięć, kalendarz, książki) żyją jako **pliki w katalogach** z rozpoznawalnymi rozszerzeniami.
Użytkownik i agent mają ten sam widok; agent operuje przez tools `fs.*`.

## Zasady

1. **Serwer = źródło prawdy** — pliki w DB / object storage, nie tylko na dysku klienta.
2. **Wirtualny root** — `~` lub `/home` w UI; fizycznie prefix `user/{userId}/`.
3. **Rozszerzenia** oznaczają typ — parser wie jak renderować / edytować.
4. **Katalogi** grupują domeny — nie jeden wielki JSON.
5. Agent **nie** dostaje listy plików w prompcie — `fs.list`, `fs.read`, `fs.write`.

## Drzewo katalogów (propozycja)

```
~/
├── memory/
│   ├── long-term.memory      # pamięć długoterminowa (linie / JSONL)
│   └── short-term.memory     # opcjonalny eksport short (głównie DB)
├── todo/
│   └── global.todo           # globalna lista zadań (format poniżej)
├── notes/
│   ├── chemia/
│   │   └── kwasy.md
│   └── matma/
│       └── funkcje.md
├── calendar/
│   ├── 2026-09.cal           # jeden plik na miesiąc
│   └── 2026-10.cal
├── school/
│   ├── librus/
│   │   ├── grades.json       # ostatni snapshot ocen
│   │   ├── schedule.json     # plan lekcji
│   │   └── timetable-changes.json
│   └── subjects/
│       └── chemia.subject    # meta przedmiotu
├── books/
│   ├── chemia/
│   │   └── podrecznik.pdf    # upload użytkownika
│   └── matma/
│       └── zbior-zadan.pdf
├── plans/
│   ├── 2026-09-02.plan       # plan dnia
│   └── week-2026-36.plan     # plan tygodnia
└── profile/
    └── me.profile            # profil ucznia, preferencje czasu
```

## Rozszerzenia plików

| Rozszerzenie | Zawartość | Edycja w UI |
| ------------ | --------- | ----------- |
| `.memory` | JSONL wpisów pamięci | read-only + panel pamięci |
| `.todo` | Markdown z checkboxami + metadane YAML frontmatter | edytor TODO |
| `.md` | Notatki Markdown | edytor notatek |
| `.cal` | Wydarzenia miesiąca (JSON lub iCal subset) | widok kalendarza |
| `.plan` | Plan dnia/tygodnia (Markdown + bloki czasu) | widok planu |
| `.profile` | YAML/JSON profilu | formularz ustawień |
| `.subject` | Meta przedmiotu (cel średniej, nauczyciel) | formularz |
| `.json` | Snapshoty (Librus) | read-only, sync |
| `.pdf`, obrazy | Książki / materiały | podgląd + AI read |

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

| Tool | Opis |
| ---- | ---- |
| `fs.list` | `{ path: string }` → lista plików/katalogów |
| `fs.read` | `{ path: string, offset?, limit? }` → treść (tekst) lub meta (binarny) |
| `fs.write` | `{ path, content, createOnly? }` |
| `fs.append` | `{ path, content }` — np. dopisanie do `.memory` |
| `fs.mkdir` | `{ path }` |
| `fs.delete` | `{ path }` — z potwierdzeniem dla ważnych plików |
| `fs.search` | `{ query, path?, glob? }` — grep po notatkach/książkach (tekst) |

Dla PDF/książek: `fs.read` zwraca wyciągnięty tekst (jak obecny pipeline załączników).

## API (HTTP)

| Method | Path | Opis |
| ------ | ---- | ---- |
| GET | `/api/fs?path=~` | list |
| GET | `/api/fs/file?path=...` | read |
| PUT | `/api/fs/file` | write |
| POST | `/api/fs/mkdir` | mkdir |
| DELETE | `/api/fs/file?path=...` | delete |
| POST | `/api/fs/upload` | upload do `books/` itd. |

## UI

- Panel „Pliki” — drzewo po lewej, podgląd/edycja po prawej
- Ikony wg rozszerzenia
- Drag & drop upload do `books/` lub `notes/`
- Komenda `/files` otwiera panel

## Bezpieczeństwo

- Ścieżki sanityzowane — brak `../` poza root użytkownika
- Jeden user (single-user) — na start bez auth, potem prosty token
- Backup: eksport całego `~/` jako zip (nice-to-have)

## Definition of Done

- [ ] Wirtualny FS w API + DB
- [ ] Min. katalogi: `memory/`, `todo/`, `notes/`, `calendar/`, `books/`
- [ ] Tools `fs.list`, `fs.read`, `fs.write`
- [ ] UI drzewa plików
- [ ] Globalna TODO jako `~/todo/global.todo`
