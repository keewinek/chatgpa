# Aktualny prompt — skopiuj do nowego agenta

| | |
| --- | --- |
| **Epik** | Prompt 1 — Serwer + PostgreSQL + Drizzle |
| **Faza** | 2A |
| **Status** | ⏳ **DO ZROBIENIA** |
| **Następny po tym** | Prompt 2 — Wirtualny system plików |
| **Ostatnia aktualizacja** | 2026-09-02T16:15:00+02:00 |

> Skopiuj cały blok poniżej i wklej jako **pierwszą wiadomość** w nowym czacie agenta.

```
Implementuj Fazę 2A ChatGPA: serwer i baza danych.

Przeczytaj:
- ai-kontekst/serwer-i-sync.md
- ai-kontekst/architektura.md
- ai-kontekst/model-danych.md
- ai-kontekst/dla-agenta.md

Zadanie:
1. Dodaj PostgreSQL + Drizzle do packages/api (migracje, connection z env DATABASE_URL).
2. Tabele na start: profile, chat_threads, chat_messages, memory_entries, tasks, file_nodes (wirtualny FS).
3. Endpointy health sprawdzające DB.
4. Szkielet sync: GET /api/sync/pull, POST /api/sync/push (minimalna implementacja).
5. .env.example z DATABASE_URL.
6. Testy integracyjne z mockiem lub testcontainers jeśli możliwe.

Nie rób jeszcze: Librus, powiadomień, pełnego UI sync — tylko backend + migracje.
OBOWIĄZKOWE po zakończeniu epiku (w tej kolejności):
1. deno task test — musi przejść
2. Zaktualizuj ai-kontekst/roadmap.md (odhacz odpowiedni punkt)
3. deno task epic:done — automatycznie przesuwa następny prompt (NIE kończ sesji bez tego!)
4. (opcjonalnie) wpis w ai-kontekst/decyzje.md
```
