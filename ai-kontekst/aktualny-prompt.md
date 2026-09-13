# Aktualny prompt — skopiuj do nowego agenta

| | |
| --- | --- |
| **Epik** | Prompt 14 — Agent core: dłuższa pętla narzędzi + fs.grep |
| **Faza** | 4A |
| **Status** | ⏳ **DO ZROBIENIA** |
| **Następny po tym** | Prompt 15 — Bezpieczne edycje plików: diff + undo |
| **Ostatnia aktualizacja** | 2026-09-13T16:38:02.374Z |

> Skopiuj cały blok poniżej i wklej jako **pierwszą wiadomość** w nowym czacie agenta.

```
Implementuj Fazę 4A ChatGPA: dojrzalszy silnik agenta (poziom Cursor/Claude Code/Codex).

Przeczytaj:
- ai-kontekst/wizja.md (sekcja „Metafora Cursor / Claude Code / Codex”)
- ai-kontekst/dla-agenta.md
- ai-kontekst/decyzje.md (2026-09-04 „Agent FS-first”, 2026-09-13 „Faza 4”)
- packages/api/ai/chat.ts, packages/api/ai/tools.ts, packages/api/ai/system-prompt.ts

Zadanie:
1. Podnieś MAX_TOOL_ROUNDS w packages/api/ai/chat.ts (np. 3 → 8) i zamień sztywną shouldFinalize na mądrzejszą heurystykę (koniec gdy model nie woła już narzędzi, nie tylko po liczbie rund lub specjalnym przypadku plan.generate).
2. Dodaj narzędzie fs.grep({ query, path?, limit? }) w tools.ts — pełnotekstowe wyszukiwanie po plikach pod ~/ (case-insensitive substring wystarczy na start), zwraca listę { path, line, snippet }.
3. Zaktualizuj SYSTEM_PROMPT (system-prompt.ts) o fs.grep — kiedy używać zamiast zgadywania ścieżki / przeglądania katalogów po kolei.
4. Testy: tools_test.ts dla fs.grep (trafienia, brak wyników, limit); test w chat.ts na >3 rundy narzędzi.
5. Zsynchronizuj ai-kontekst/system-plikow.md z nową listą narzędzi.

Nie rób jeszcze: diff/undo (epik 15), polish UI (epik 16).
OBOWIĄZKOWE po zakończeniu epiku (w tej kolejności):
1. deno task test — musi przejść
2. Zaktualizuj ai-kontekst/roadmap.md (odhacz odpowiedni punkt)
3. deno task epic:done — automatycznie przesuwa następny prompt (NIE kończ sesji bez tego!)
4. (opcjonalnie) wpis w ai-kontekst/decyzje.md
```
