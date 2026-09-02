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

- **Decyzja:** dodać sloty `zai` (glm-4.7-flash, glm-4.5-flash) i `mistral` (small, nemo) jako
  OpenAI-compatible fallback.
- **Kontekst:** więcej darmowych dostawców = mniej 503 przy limitach Gemini/Groq.
- **Konsekwencje:** `ZAI_API_KEY`, `MISTRAL_API_KEY` w `.env.example`; sync `AI-dostawcy.md`.

## 2026-09-02 — Statyczny plan lekcji 3A w core

- **Decyzja:** plan tygodnia klasy 3A w `packages/core/timetable.ts` + UI + kontekst AI;
  `groupPrefs` w localStorage i API.
- **Kontekst:** szybka wartość przed Librus; powiadomienia i plan dnia potrzebują godzin lekcji.
- **Konsekwencje:** wyjątek od lazy context dla planu; później sync Librus → `schedule.json` lub
  merge z core.

## 2026-09-02 — Automatyczna kolejka epików (`epic:done`)

- **Decyzja:** `deno task epic:done` po każdym agencie regeneruje `aktualny-prompt.md` i sekcję w
  `plan-implementacji.md`.
- **Kontekst:** użytkownik nie chce ręcznie podmieniać promptów; stan w `epic-state.json`, treści w
  `epics.json`.
- **Konsekwencje:** agent **musi** uruchomić `epic:done` przed końcem sesji; `dla-agenta.md`
  punkt 7.

## 2026-09-02 — PostgreSQL + Drizzle (Faza 2A)

- **Decyzja:** PostgreSQL jako source of truth; Drizzle ORM + migracje SQL; sync pull/push po
  `updatedAt`.
- **Kontekst:** multi-device sync, tabele: profile, chat_threads, chat_messages, memory_entries,
  tasks, file_nodes.
- **Konsekwencje:** `DATABASE_URL` w `.env`; `deno task -f @chatgpa/api db:migrate`; testy
  integracyjne przez PGLite.

## 2026-09-02 — Sync czatów (IndexedDB + serwer)

- **Decyzja:** czaty w PostgreSQL (`chat_threads`, `chat_messages` + `metadata` jsonb); klient cache
  w IndexedDB; pull on start (`/api/sync/pull`), push po wiadomości (`/api/threads` CRUD);
  jednorazowa migracja `POST /api/migrate/local`.
- **Kontekst:** epik Prompt 13 — multi-device historia rozmów; kompatybilność wsteczna z
  localStorage do czasu migracji.
- **Konsekwencje:** `packages/web/lib/chat-idb.ts`, `threads-api.ts`; `loadStore()` sync fallback;
  `initChatSync()` na starcie aplikacji.

## Oczekujące

- Extension w monorepo `packages/extension` vs osobne repo — ✅ **monorepo** (2026-09-02, epik
  Librus)
- Streaming SSE — ✅ zrobione

## 2026-09-02 — Librus extension w monorepo

- **Decyzja:** wtyczka MV3 w `packages/extension`; sync przez `POST /api/librus/sync`; hasło tylko w
  przeglądarce.
- **Kontekst:** epik Prompt 10 — oceny, plan, terminarz, zmiany planu; merge snapshotów zamiast
  ślepego nadpisania.
- **Konsekwencje:** pliki `~/school/librus/*.json`, merge kalendarza/TODO, krótka pamięć przy
  zmianach; UI przycisk „Sync Librus”.

## 2026-09-02 — Architektura „OS + pliki”

- **Decyzja:** dane użytkownika jako wirtualny FS (`~/todo`, `~/notes`, `~/calendar`, …) + DB jako
  source of truth.
- **Kontekst:** sync multi-device, agent i user widzą te same pliki, rozszerzenia `.todo`, `.cal`,
  `.plan`, `.memory`.
- **Konsekwencje:** epik system-plików przed TODO/notatki/pamięć; tools `fs.*`.

## 2026-09-02 — Pamięć short vs long

- **Decyzja:** short-term z `expiresAt`; long-term w pliku + DB; nie wstrzykiwać całości do promptu.
- **Kontekst:** `/clear short memory`, kontekst między czatami bez przepełniania tokenów.
- **Konsekwencje:** migracja z `string[]` memory; nowe tools `memory.clear`.

## 2026-09-02 — Lazy context (tools-first)

- **Decyzja:** agent pobiera oceny, TODO, kalendarz przez tools; deprecated duży ContextPacket w
  prompcie.
- **Kontekst:** mniej halucynacji, świeższe dane, skalowalność.
- **Konsekwencje:** przebudowa system-prompt.ts; nowe tools `grades.*`, `calendar.*`, `todo.*`.

## 2026-09-02 — Lazy context wdrożony (epik 2H)

- **Decyzja:** `withChatContext` wstrzykuje tylko datę/czas + plan lekcji; reszta przez tools.
- **Tools:** `grades.get` (czyta `~/school/librus/grades.json`), `calendar.list`,
  `calendar.freeSlots` (stub).
- **Test:** pytanie o oceny bez sync → `grades.get` zwraca brak danych, nie halucynacja.

## 2026-09-02 — Globalna TODO (DB + plik)

- **Decyzja:** tabela `tasks` jako source of truth; dual-write do `~/todo/global.todo` po każdej
  mutacji; dedykowane tools `todo.*` zamiast ręcznego parsowania przez `fs.write`.
- **Kontekst:** agent, API i UI operują na tym samym modelu `Task`; plik `.todo` służy do podglądu w
  panelu Pliki i syncu.
- **Konsekwencje:** `/api/todos` CRUD, panel TODO w UI, komenda `/todo` otwiera panel (bez pełnego
  parsera slash).

## 2026-09-02 — Notatki Markdown (~/notes)

- **Decyzja:** dedykowane API `/api/notes` jako cienka warstwa nad `fs.*` ograniczona do `~/notes/`;
  tools `notes.list|read|write|append` z auto-`.md` i tworzeniem katalogów nadrzędnych.
- **Kontekst:** agent zapisuje notatki po lekcji; UI split editor + podgląd Markdown; sync przez
  istniejący FS.
- **Konsekwencje:** panel Notatki, komenda `/notes` (opcjonalnie `/notes otwórz chemia/kwasy`).

## 2026-09-02 — Powiadomienie po szkole

- **Decyzja:** 30 min po ostatniej lekcji; klik → nowy czat z wiadomością agenta + TODO dziś +
  budżet minut.
- **Kontekst:** anty-prokrastynacja, negocjacja planu w czacie.
- **Konsekwencje:** zależy od planu lekcji (Librus) i profilu czasu
  ([kalendarz.md](./kalendarz.md)).

## 2026-09-02 — Profil czasu (domyślne)

- **Decyzja:** powrót do domu +60 min po lekcjach; koniec nauki 21:00 (max 21:30); +30 min bufor
  obiadu opcjonalnie.
- **Kontekst:** wymagania użytkownika dla `calendar.freeSlots`.
- **Konsekwencje:** pola w `me.profile`.

## 2026-09-02 — Kalendarz i profil czasu (implementacja)

- **Decyzja:** dedykowane API `/api/calendar` i `/api/profile` nad wirtualnym FS; pliki
  `YYYY-MM.cal` (JSON) i `me.profile` (YAML); `calendar.freeSlots` liczy okna z planu lekcji 3A +
  profilu, odejmuje wydarzenia z `.cal`.
- **Kontekst:** epik 7 — agent planuje naukę w realnych oknach czasowych bez Librus sync.
- **Konsekwencje:** tools `calendar.list|add|update|freeSlots`, UI miesiąc/tydzień + formularz
  profilu; merge Librus w kolejnym epiku.

## 2026-09-02 — Pomodoro timer

- **Decyzja:** overlay modal (`PomodoroPanel`) z cyklami 25/5 min; dźwięk opcjonalny (Web Audio API,
  pref w `localStorage`); otwarcie przez `/pomodoro` lub przycisk 🍅 w nagłówku czatu.
- **Kontekst:** epik 9 — skupienie bez integracji z planem dnia.
- **Konsekwencje:** brak sync z kalendarzem/TODO na razie; styl w `styles.css` sekcja Pomodoro.

- **Decyzja:** parser w `packages/web/lib/commands.ts`; nieznana komenda → zwykła wiadomość do AI;
  seed prompty ukryte (użytkownik widzi `/plan`, AI dostaje pełny prompt PL).
- **Kontekst:** skróty jak w Slacku — UI, API i seed prompty bez blokowania czatu.
- **Konsekwencje:** autocomplete przy `/`; `/pomodoro` jako overlay modal; testy parsera w
  `packages/web/lib/commands_test.ts`.

## 2026-09-02 — Plan dzienny: algorytm + wąski prompt AI

- **Decyzja:** moduł `packages/api/plan/` — dystrybucja T-7 deterministyczna (wagi T-7/T-3/T-1),
  jeden call `runCascade` z wąskim promptem (fallback bez kluczy); zapis `~/plans/YYYY-MM-DD.plan`,
  `todo.scheduledFor`, `study_block` w kalendarzu; cron `0 6 * * *`.
- **Kontekst:** epik 11 — anty-prokrastynacja bez pełnego kontekstu czatu.
- **Konsekwencje:** `POST /api/plan/generate?date=...`; kolumna `scheduled_for` w tasks;
  powiadomienia (epik 12) korzystają z wygenerowanej wiadomości.

## 2026-09-02 — Powiadomienia: cron + in-app + Web Push (VAPID)

- **Decyzja:** tabela `notifications` w PostgreSQL; cron co godzinę (`0 * * * *`) sprawdza
  `notificationAt` z `calendar.freeSlots` i tworzy `daily_plan` + alerty T-7/T-3/T-1; klik w banner
  otwiera nowy czat z prefillem asystenta + embed TODO/budżet; negocjacja przez istniejące tools
  (`todo.update`, `calendar.add`); Web Push opcjonalny przez `web-push` + `sw.js` gdy ustawione
  `VAPID_*` w env.
- **Kontekst:** epik 12 — powiadomienie po szkole z planem dziś i możliwością przesunięcia zadań w
  czacie.
- **Konsekwencje:** `GET/PATCH /api/notifications`, `POST /api/notifications/subscribe`; banner w
  `ChatApp`; push w quiet hours (`studyEndHard`) pomijany, wyjątek T-1 rano 7–8.
