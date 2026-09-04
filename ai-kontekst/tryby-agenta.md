# Tryby agenta (Cursor → szkoła)

ChatGPA docelowo ma tryby jak Cursor, ale semantykę szkolną.

## Ask

**Cel:** szybka odpowiedź / wyjaśnienie bez zmiany stanu systemu.

Przykłady:

- „Wyjaśnij prawo Ohma prostymi słowami.”
- „Co oznacza ta kategoria oceny w Librusie?”
- „Streść ten akapit.”

Zasady: nie tworzy TODO, nie rusza kalendarza, może tylko proponować.

## Plan

**Cel:** ułożyć strategię (plan dnia / powtórki / tygodnia), pokazać kroki, czekać na akceptację.

Przykłady:

- „Ułóż plan na jutro przed kartkówką z biologii.”
- „Jak dojść do średniej 4.5 z matmy w 3 tygodnie?”

Output: checklista + szacowany czas + priorytety ROI. Po „ok, zapisz” → narzędzia zapisują.

## Agent

**Cel:** wykonać wielokrokowe zadanie jak w Cursorze — przez pliki pod `~/`.

Przykłady:

- „Dodaj powtórkę chemii na środę” → `fs.read` / `fs.write` `~/todo/global.todo` (+ ewentualnie `.cal`).
- „Zapamiętaj że mam grupę 2 z WF” → edycja `~/school/groups.json` lub pamięci.
- „Ułóż plan na dziś” → `plan.generate`.

Guardrails:

- nie kasuje ważnych plików bez potrzeby (`fs.delete`),
- nie wysyła nic na zewnątrz poza AI cascade / `web.search`,
- pokazuje użyty model.

## Focus

**Cel:** sesja głębokiej pracy (25/50 min) na jednym temacie.

- timer,
- quiz / flashcards,
- zakaz przełączania na inne przedmioty (soft),
- po sesji: update trackera wiedzy.

## Diff wiedzy

**Cel:** pokazać zmiany jak git diff.

- średnia przed/po tygodniu,
- nowe oceny,
- tematy: było „nie umiem” → „umiem”,
- zaległe TODO.

## Mapowanie na UI

| Tryb  | Wejście UI            | Faza |
| ----- | --------------------- | ---- |
| Ask   | domyślny chat         | 0 ✅ |
| Plan  | przełącznik / komenda | 1    |
| Agent | przełącznik + tools   | 2–3  |
| Focus | osobny panel sesji    | 3    |
| Diff  | komenda `/diff`       | 2    |
