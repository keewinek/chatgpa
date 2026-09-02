# Serwer, baza danych i sync multi-device

## Cel

Aplikacja **tylko dla Ciebie**, ale na **telefonie i komputerze** z tym samym:

- historią czatów
- pamięcią (short + long)
- TODO
- notatkami
- plikami (system plików)
- kalendarzem i snapshotami Librus

## Stan obecny

| Dane                    | Gdzie            | Problem                             |
| ----------------------- | ---------------- | ----------------------------------- |
| Czaty + pamięć          | `localStorage`   | Brak sync, tylko jedna przeglądarka |
| Pliki upload            | Deno KV, TTL 24h | Nie trwałe                          |
| TODO, kalendarz, profil | —                | Nie istnieje                        |

## Kierunek architektoniczny

**Jeden backend (Hono API) + jedna baza PostgreSQL** — hostowane tanio / darmowo (np. Neon free
tier, Supabase free, lub VPS z Postgres).

Single-user: **bez pełnego auth SaaS** na start:

- Prosty token API w `.env` / ustawieniach klienta, lub
- Magic link / jeden login (później)

## Co trafia do DB

| Tabela / store     | Zawartość                             |
| ------------------ | ------------------------------------- |
| `chat_threads`     | Sesje czatu                           |
| `chat_messages`    | Wiadomości                            |
| `memory_entries`   | Short + long memory                   |
| `files`            | Metadane + blob (lub S3-compatible)   |
| `file_contents`    | Treść plików wirtualnego FS           |
| `tasks`            | TODO (odzwierciedlenie `global.todo`) |
| `calendar_events`  | Wydarzenia (odzwierciedlenie `.cal`)  |
| `librus_snapshots` | Historia synców                       |
| `notifications`    | Kolejka / historia powiadomień        |
| `profile`          | Profil ucznia                         |

Opcjonalnie: **pliki jako source of truth** — DB przechowuje blob path + sync; logika odczytu przez
warstwę `fs`.

## Stack (propozycja)

| Warstwa    | Tech                                  |
| ---------- | ------------------------------------- |
| ORM        | Drizzle                               |
| DB         | PostgreSQL (pgvector później pod RAG) |
| Migracje   | `drizzle-kit`                         |
| Deploy API | Deno Deploy / VPS                     |
| Deploy web | Ten sam host (Fresh) lub static + API |

## Sync model (klient)

```
App start / co N minut / po akcji użytkownika:
  1. GET /api/sync/pull?since={cursor}
  2. Merge do lokalnego cache (IndexedDB lepsze niż localStorage dla dużych danych)
  3. Push lokalnych zmian: POST /api/sync/push { changes[] }
```

- **Offline:** kolejka zmian; przy powrocie online — push
- **Konflikt:** last-write-wins (v1); entity versioning (v2)

## Migracja z localStorage

1. Endpoint `POST /api/migrate/local` — jednorazowy import z body `{ store: v2 JSON }`
2. Po sukcesie klient przełącza się na `sync` i czyści stary klucz (z backupem)

## Endpointy (szkic)

| Method   | Path                                        | Opis           |
| -------- | ------------------------------------------- | -------------- |
| GET/POST | `/api/sync/pull`                            | Pobierz zmiany |
| POST     | `/api/sync/push`                            | Wyślij zmiany  |
| CRUD     | `/api/threads`, `/api/threads/:id/messages` | Czaty          |
| CRUD     | `/api/memory`                               | Pamięć         |
| CRUD     | `/api/todos`                                | TODO           |
| CRUD     | `/api/fs/*`                                 | System plików  |
| GET/PUT  | `/api/profile`                              | Profil         |

## Koszt

- Postgres free tier + Deno Deploy free = **0 zł** w happy-path
- Bez płatnych usług sync (Firebase paid, etc.)

## Decyzja do podjęcia

Zobacz [decyzje.md](./decyzje.md) — wpis o storage Fazy 2.

## Definition of Done

- [x] PostgreSQL + Drizzle w `packages/api`
- [x] Czaty na serwerze (nie tylko localStorage)
- [ ] Sync pull/push między 2 urządzeniami
- [ ] Pamięć, TODO, notatki na serwerze
- [x] Migracja z localStorage
