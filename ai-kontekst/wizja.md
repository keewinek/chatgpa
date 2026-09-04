# Wizja — Cursor do szkoły

## Problem

Uczeń ma rozproszone źródła: Librus (oceny, zadania, sprawdziany), notatki, kalendarz, chaty z AI.
Brakuje jednego miejsca, które **wie wszystko o Tobie i szkole**, planuje dzień i pilnuje nauki.

Typowy chaos:

- „Kiedy mam sprawdzian z chemii?” — w Librusie, ale nie w głowie.
- „Co powtórzyć dziś?” — zero priorytetów względem wag ocen.
- ChatGPT nie zna Twojej średniej ani zaległych prac.
- Notatki są, ale nie ma quizów / spaced repetition.

## Produkt

**ChatGPA** = osobisty AI-copilot edukacyjny (jak Cursor, ale do szkoły).

Nie jest to produkt komercyjny na start — to system **dla Ciebie**. Dlatego cały stack kosztów = **0
zł**:

- darmowe API AI (wiele dostawców, kaskada fallback),
- self-host / lokalny Deno,
- Librus przez własną wtyczkę / scraper (osobny tor).

## Doświadczenie docelowe (dzień z ChatGPA)

| Moment          | Co się dzieje                                          |
| --------------- | ------------------------------------------------------ |
| Rano            | Push / otwarcie: plan dnia (3–5 bloków nauki + szkoły) |
| W szkole        | Szybki Ask: „o co chodziło na lekcji” / notatka → quiz |
| Po szkole       | Agent układa TODO według ROI (wagi × luki wiedzy)      |
| Przed kartkówką | Focus mode: tylko ten temat, pytania, bez rozpraszaczy |
| Wieczór         | Retrospektywa: co zrobione, co przełożyć, energia      |
| Niedziela       | Plan tygodnia + sync Librus                            |

## Metafora „Cursor”

| Cursor (kod)       | ChatGPA (szkoła)                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Workspace projektu | Profil ucznia + kontekst szkoły                                                              |
| Pliki / git        | **Wirtualny FS `~/`** — single source of truth ([system-plikow.md](./system-plikow.md))       |
| Agent / chat       | Chat edukacyjny z narzędziami; edycja plików = zmiana stanu OS                               |
| Autocomplete       | Sugestie planu nauki                                                                         |
| Background agents  | Automatyzacje w tle (plan dnia, alerty)                                                      |
| Diff / PR          | Diff wiedzy / zmiana średniej                                                                |
| Rules / AGENTS.md  | Ten folder `ai-kontekst/` + profil                                                           |
| MCP / tools        | Głównie `fs.*` (+ `plan.generate`, `web.search`, …) — szkoła jak codebase |

**Kierunek:** im więcej funkcji, tym więcej z nich powinno być „po prostu plikiem” (`.todo`, `.cal`,
`.plan`, `.profile`, `.ui`, `groups.json`…). Panele UI nie trzymają osobnej prawdy — renderują FS.

## North-star metrics (osobiste)

- Średnia ważona ↑ w kierunku targetu (np. 4.75).
- Zero „zaskoczeń” terminami (alert T-3 / T-1).
- Czas nauki idzie w tematy o najwyższym ROI, nie losowo.
- Chat używany codziennie jako hub, nie tylko „gdy panika”.

## Persona

- Ty: uczeń, chcesz podnieść średnią / ogarnąć tydzień bez chaosu.
- Język UI: polski.
- Ton AI: konkretny, motywujący, bez lania wody; tłumaczy jak dobry korepetytor.
- Preferencje (do profilu): ile minut dziennie, kiedy quiet hours, słabe przedmioty.

## Anti-persona / czego to NIE jest

- Nie LMS dla szkoły / nauczycieli.
- Nie ściąga na sprawdzian (tłumaczy i trenuje — nie oszukuje).
- Nie kolejny notatnik bez AI i bez kontekstu ocen.
