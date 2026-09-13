# Aktualny prompt — skopiuj do nowego agenta

| | |
| --- | --- |
| **Epik** | Prompt 15 — Bezpieczne edycje plików: diff + undo |
| **Faza** | 4B |
| **Status** | ⏳ **DO ZROBIENIA** |
| **Następny po tym** | Prompt 16 — Polish do codziennego użytku |
| **Ostatnia aktualizacja** | 2026-09-13T17:04:13.628Z |

> Skopiuj cały blok poniżej i wklej jako **pierwszą wiadomość** w nowym czacie agenta.

```
Implementuj Fazę 4B ChatGPA: diff i undo dla zapisu plików wirtualnego FS.

Przeczytaj:
- ai-kontekst/system-plikow.md
- ai-kontekst/decyzje.md (2026-09-04 „Pliki wirtualnego FS = source of truth”, „Revive soft-deleted file paths”)
- packages/api/fs/**, packages/api/db (schemat file_nodes)

Zadanie:
1. fs.write zwraca w wyniku narzędzia prosty diff (przed/po, linia po linii) zamiast tylko potwierdzenia zapisu — pokaż go w UI (panel Plików / dymek narzędzia w czacie).
2. Prosta historia wersji: przy nadpisaniu istniejącego pliku zachowaj poprzednią treść (nowa tabela wersji albo pole w file_nodes), np. ostatnie 5 wersji na plik.
3. Endpoint/tool do cofnięcia: fs.history({ path }) + przycisk „Cofnij” w panelu Plików na poprzednią wersję.
4. Testy: nadpisanie zachowuje starą wersję; undo przywraca dokładnie poprzednią treść.
5. Zaktualizuj system-plikow.md o wersjonowanie/undo.

Zależy od: epik 14 (fs.grep) niekoniecznie, ale kończ chat.ts/tools.ts zmiany z epiku 14 najpierw żeby uniknąć konfliktów.
OBOWIĄZKOWE po zakończeniu epiku (w tej kolejności):
1. deno task test — musi przejść
2. Zaktualizuj ai-kontekst/roadmap.md (odhacz odpowiedni punkt)
3. deno task epic:done — automatycznie przesuwa następny prompt (NIE kończ sesji bez tego!)
4. (opcjonalnie) wpis w ai-kontekst/decyzje.md
```
