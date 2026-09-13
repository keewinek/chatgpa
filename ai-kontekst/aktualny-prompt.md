# Aktualny prompt — skopiuj do nowego agenta

| | |
| --- | --- |
| **Epik** | Prompt 16 — Polish do codziennego użytku |
| **Faza** | 4C |
| **Status** | ⏳ **DO ZROBIENIA** |
| **Następny po tym** | ✅ koniec kolejki |
| **Ostatnia aktualizacja** | 2026-09-13T17:27:25.495Z |

> Skopiuj cały blok poniżej i wklej jako **pierwszą wiadomość** w nowym czacie agenta.

```
Zamknij Fazę 4 ChatGPA: polish i pełny ręczny przegląd przed codziennym użyciem.

Przeczytaj:
- ai-kontekst/decyzje.md (2026-09-13 „Ręczny test end-to-end”)
- packages/web/lib/threads-api.ts
- ai-kontekst/roadmap.md (sekcja Definition of Done)

Zadanie:
1. Napraw szumiące 404 w threads-api.ts — GET „czy wątek/wiadomość istnieje” przed POST zawsze failuje dla nowej rozmowy. Zamień na idempotentny POST/upsert albo inny sposób bez zbędnego requestu, który zawsze 404uje.
2. Manualny przegląd end-to-end wszystkich paneli (Pliki, TODO, Notatki, Kalendarz, Profil, status Librus, Pomodoro, Powiadomienia) w deno task dev — napraw drobne błędy znalezione po drodze, nie dodawaj nowych funkcji.
3. Przejrzyj ai-kontekst/ — skróć/zarchiwizuj nieaktualne fragmenty (np. archiwum promptów 1–13 w plan-implementacji.md), żeby kontekst nie puchł bez końca.
4. Upewnij się, że roadmap.md „Definition of Done” jest w pełni odhaczone, włącznie z nowym punktem o agencie poziomu Cursor/Claude Code.

Po tym epiku: ChatGPA to gotowy, przetestowany osobisty produkt — kolejne funkcje (sekcja „Później / someday” w roadmap.md) tylko na wyraźną prośbę.
OBOWIĄZKOWE po zakończeniu epiku (w tej kolejności):
1. deno task test — musi przejść
2. Zaktualizuj ai-kontekst/roadmap.md (odhacz odpowiedni punkt)
3. deno task epic:done — automatycznie przesuwa następny prompt (NIE kończ sesji bez tego!)
4. (opcjonalnie) wpis w ai-kontekst/decyzje.md
```
