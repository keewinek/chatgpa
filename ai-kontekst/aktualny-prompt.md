# Aktualny prompt — skopiuj do nowego agenta

| | |
| --- | --- |
| **Epik** | Prompt 5 — Notatki Markdown |
| **Faza** | 2E |
| **Status** | ⏳ **DO ZROBIENIA** |
| **Następny po tym** | Prompt 6 — Lazy context + tools |
| **Ostatnia aktualizacja** | 2026-09-02T14:39:10.267Z |

> Skopiuj cały blok poniżej i wklej jako **pierwszą wiadomość** w nowym czacie agenta.

```
Implementuj system notatek Markdown ChatGPA.

Przeczytaj:
- ai-kontekst/notatki.md
- ai-kontekst/system-plikow.md

Zadanie:
1. Notatki w ~/notes/ przez API fs lub dedykowane /api/notes.
2. UI: lista katalogów + edytor Markdown (split preview).
3. Tools notes.list, notes.read, notes.write (lub fs.* w notes/).
4. Komenda /notes otwiera panel.
OBOWIĄZKOWE po zakończeniu epiku (w tej kolejności):
1. deno task test — musi przejść
2. Zaktualizuj ai-kontekst/roadmap.md (odhacz odpowiedni punkt)
3. deno task epic:done — automatycznie przesuwa następny prompt (NIE kończ sesji bez tego!)
4. (opcjonalnie) wpis w ai-kontekst/decyzje.md
```
