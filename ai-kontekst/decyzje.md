# Decyzje (ADR-lite)

Format: data · decyzja · kontekst · konsekwencje.

## 2026-08-26 — Deno monorepo (Hono + Fresh)

- **Decyzja:** jeden runtime Deno dla API i web.
- **Kontekst:** TypeScript-first, proste self-host.
- **Konsekwencje:** workspace `packages/*`, wspólne typy w `@chatgpa/core`.

## 2026-08-26 — Tylko darmowe AI + kaskada

- **Decyzja:** multi-provider cascade smart→dumb; zero płatnych modeli w happy-path.
- **Kontekst:** budżet 0 zł, single-user.
- **Konsekwencje:** zależność od limitów free tier; trzeba wielu kluczy dla resiliency.

## 2026-08-26 — Chat UI jako MVP

- **Decyzja:** Faza 0 = ChatGPT-like UI + badge modelu, zanim Librus/TODO.
- **Kontekst:** najszybsza wartość: „mogę pisać z AI”.
- **Konsekwencje:** brak historii trwałej na start (dopiero Faza 1).

## 2026-08-26 — Librus przez wtyczkę (kierunek)

- **Decyzja:** preferujemy browser extension zamiast server-side login.
- **Kontekst:** hasła/2FA/ToS.
- **Konsekwencje:** osobny tor implementacji; sync gdy user zalogowany w Librus.

## 2026-08-26 — Folder `ai-kontekst/`

- **Decyzja:** Markdown kontekst jako źródło prawdy dla agentów i człowieka.
- **Kontekst:** projekt ma rosnąć; chat historii nie wystarczy.
- **Konsekwencje:** trzeba aktualizować kontekst przy decyzjach.

## 2026-09-02 — Z.AI + Mistral w kaskadzie

- **Decyzja:** dodać sloty `zai` (glm-4.7-flash, glm-4.5-flash) i `mistral` (small, nemo) jako OpenAI-compatible fallback.
- **Kontekst:** więcej darmowych dostawców = mniej 503 przy limitach Gemini/Groq.
- **Konsekwencje:** `ZAI_API_KEY`, `MISTRAL_API_KEY` w `.env.example`; sync `AI-dostawcy.md`.

## 2026-09-02 — Statyczny plan lekcji 3A w core

- **Decyzja:** plan tygodnia klasy 3A w `packages/core/timetable.ts` + UI + kontekst AI; `groupPrefs` w localStorage i API.
- **Kontekst:** szybka wartość przed Librus; powiadomienia i plan dnia potrzebują godzin lekcji.
- **Konsekwencje:** wyjątek od lazy context dla planu; później sync Librus → `schedule.json` lub merge z core.

## 2026-09-02 — Automatyczna kolejka epików (`epic:done`)

- **Decyzja:** `deno task epic:done` po każdym agencie regeneruje `aktualny-prompt.md` i sekcję w `plan-implementacji.md`.
- **Kontekst:** użytkownik nie chce ręcznie podmieniać promptów; stan w `epic-state.json`, treści w `epics.json`.
- **Konsekwencje:** agent **musi** uruchomić `epic:done` przed końcem sesji; `dla-agenta.md` punkt 7.

## 2026-09-02 — PostgreSQL + Drizzle (Faza 2A)

- **Decyzja:** PostgreSQL jako source of truth; Drizzle ORM + migracje SQL; sync pull/push po `updatedAt`.
- **Kontekst:** multi-device sync, tabele: profile, chat_threads, chat_messages, memory_entries, tasks, file_nodes.
- **Konsekwencje:** `DATABASE_URL` w `.env`; `deno task -f @chatgpa/api db:migrate`; testy integracyjne przez PGLite.

## Oczekujące

- Extension w monorepo `packages/extension` vs osobne repo — przy starcie Librus
- Streaming SSE — ✅ zrobione

## 2026-09-02 — Architektura „OS + pliki”

- **Decyzja:** dane użytkownika jako wirtualny FS (`~/todo`, `~/notes`, `~/calendar`, …) + DB jako source of truth.
- **Kontekst:** sync multi-device, agent i user widzą te same pliki, rozszerzenia `.todo`, `.cal`, `.plan`, `.memory`.
- **Konsekwencje:** epik system-plików przed TODO/notatki/pamięć; tools `fs.*`.

## 2026-09-02 — Pamięć short vs long

- **Decyzja:** short-term z `expiresAt`; long-term w pliku + DB; nie wstrzykiwać całości do promptu.
- **Kontekst:** `/clear short memory`, kontekst między czatami bez przepełniania tokenów.
- **Konsekwencje:** migracja z `string[]` memory; nowe tools `memory.clear`.

## 2026-09-02 — Lazy context (tools-first)

- **Decyzja:** agent pobiera oceny, TODO, kalendarz przez tools; deprecated duży ContextPacket w prompcie.
- **Kontekst:** mniej halucynacji, świeższe dane, skalowalność.
- **Konsekwencje:** przebudowa system-prompt.ts; nowe tools `grades.*`, `calendar.*`, `todo.*`.

## 2026-09-02 — Globalna TODO (DB + plik)

- **Decyzja:** tabela `tasks` jako source of truth; dual-write do `~/todo/global.todo` po każdej mutacji; dedykowane tools `todo.*` zamiast ręcznego parsowania przez `fs.write`.
- **Kontekst:** agent, API i UI operują na tym samym modelu `Task`; plik `.todo` służy do podglądu w panelu Pliki i syncu.
- **Konsekwencje:** `/api/todos` CRUD, panel TODO w UI, komenda `/todo` otwiera panel (bez pełnego parsera slash).

## 2026-09-02 — Powiadomienie po szkole

- **Decyzja:** 30 min po ostatniej lekcji; klik → nowy czat z wiadomością agenta + TODO dziś + budżet minut.
- **Kontekst:** anty-prokrastynacja, negocjacja planu w czacie.
- **Konsekwencje:** zależy od planu lekcji (Librus) i profilu czasu ([kalendarz.md](./kalendarz.md)).

## 2026-09-02 — Profil czasu (domyślne)

- **Decyzja:** powrót do domu +60 min po lekcjach; koniec nauki 21:00 (max 21:30); +30 min bufor obiadu opcjonalnie.
- **Kontekst:** wymagania użytkownika dla `calendar.freeSlots`.
- **Konsekwencje:** pola w `me.profile`.
