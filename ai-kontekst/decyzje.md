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

## 2026-09-04 — Pliki wirtualnego FS = source of truth

- **Decyzja:** domeny z plikiem pod `~/` traktują ten plik jako SoT; tabele (`tasks`,
  `memory_entries` long) są cache/indeksem. `fsWrite` / Save w UI importuje plik do tabeli.
- **Kontekst:** edycja `long-term.memory` / `global.todo` w Files nie zmieniała stanu aplikacji.
- **Konsekwencje:** `importLongTermFromFile`, `importTodoFromFile`; calendar/notes/profile/librus
  już były file-backed. Chat pozostaje DB-only.

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

- **Decyzja:** plik `~/todo/global.todo` jako source of truth; tabela `tasks` jest indeksem
  synchronizowanym po `fsWrite` / list / mutacjach API (dual-write DB→file po API).
- **Kontekst:** wcześniej tabela była SoT, a plik tylko eksportem — edycja w Files nic nie dawała.
- **Konsekwencje:** `importTodoFromFile` przy list/Save; tools `todo.*` nadal preferowane.

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

## 2026-09-04 — File-first jako north star produktu

- **Decyzja:** wszystko dąży do postaci plików pod `~/`; panele UI i tools domenowe są widokami /
  skrótami na FS; **bez podziału na „aplikacje” i „dane”** — `.ui` to zwykły typ pliku w tym samym
  drzewie; prompt runtime uczy agenta używać `fs.*`.
- **Kontekst:** jeden panel plików, `.ui` w folderach domenowych, `groups.json`; metafora Cursor.
- **Konsekwencje:** nowe funkcje jako format pliku; brak trybu apps/dane w UI; aktualizacja
  `system-plikow.md`, `zasady.md`, `wizja.md`.

## 2026-09-13 — Epik 16: polish, ostatni epik Fazy 4 — ChatGPA gotowe

- **Fix (realny bug, nie tylko kosmetyka):** `pushSessionToServer` w `threads-api.ts` robił GET „czy
  wątek/wiadomość istnieje” przed każdym POST/PATCH — zawsze 404 dla nowej rozmowy. Skoro
  `createThread`/`createMessage` już upsertują (epik 14/15-adjacent fix, patrz „Fix: reanimacja
  wątków czatu” wyżej), ten check jest zbędny — usunięty. `pushSessionToServer` teraz zawsze woła
  `createThreadApi`/`createMessageApi` (upsert). Usunięto martwe
  `updateThreadApi`/`updateMessageApi` (jedyni wywołujący). Zweryfikowane w przeglądarce: nowa
  wiadomość → `POST → 201`, zero 404.
- **Fix (prawdziwy bug znaleziony w przeglądzie):** `/calendar`, `/timetable`, `/profile` działały,
  ale były zahardkodowane osobno w `ChatApp.tsx` (duplikacja logiki z `commands.ts`) i **nie były w
  `COMMAND_REGISTRY`** — niewidoczne w autocomplete „/”, więc praktycznie nieodkrywalne. Dodane do
  registry + `parseSlashCommand`; trzy zduplikowane bloki w `ChatApp.tsx` usunięte na rzecz
  istniejącej generycznej ścieżki `slash?.type === "ui"` (już obsługiwała te widoki przez
  `viewFromSlash`). `filterCommands("/")` teraz zwraca 10 komend (było 7).
- **Fix (drobny):** panel Notatek pokazywał nieaktualną podpowiedź „Agent może zapisywać notatki
  narzędziem notes.write” — narzędzie zapisane w agencie to `fs.write` (FS-first od 2026-09-04).
- **Manualny przegląd end-to-end (`deno task dev`, desktop 1280×900):** Pliki (diff/undo — patrz
  epik 15), TODO (filtry, dodawanie), Notatki (pusty stan + linki), Kalendarz (siatka tygodnia,
  prawdziwe wydarzenie), Plan lekcji (siatka klasy 3A), Profil czasu (wartości zgodne z decyzją
  „Profil czasu (domyślne)”), Sync Librus (bez wtyczki → czytelny błąd, nie crash), Pomodoro (timer
  25:00 render), Powiadomienia (dzwonek poprawnie nic nie robi przy zerze nieprzeczytanych). Zero
  błędów w konsoli / sieci poza oczekiwanymi (brak wtyczki Librus).
- **Kontekst posprzątany:** archiwum promptów 1–15 w `plan-implementacji.md` (pełna treść, ~300
  linii) zwinięte do tabeli skrótów — źródło prawdy zostaje w `epics.json` / historii gita; plik 548
  → 222 linie. `roadmap.md` „Definition of Done” w pełni odhaczone; `ai-kontekst/README.md` sekcja
  „Stan” (mocno nieaktualna, sprzed Fazy 2) zaktualizowana.
- **Konsekwencje:** to był ostatni epik w kolejce (`epics.json`, 16/16) — `deno task epic:done`
  ustawia `epic-state.json.current = null`. Wszystkie 16 epików (Faza 0–4) ukończone; ChatGPA to
  gotowy, ręcznie przetestowany osobisty produkt. Kolejne funkcje → sekcja „Później / someday” w
  `roadmap.md`, tylko na wyraźną prośbę użytkownika, nie z automatu.

## 2026-09-13 — Epik 15: diff + undo dla fs.write

- **Decyzja:** `fs.write` na istniejącym pliku liczy prosty diff linia-po-linii (LCS,
  `computeLineDiff` w `fs/service.ts`) i zwraca go w wyniku (`diff: string | null` — `null` przy
  tworzeniu/reanimacji, tekst `+`/`-` przy nadpisaniu, pominięty przy no-op save). Widoczny w dymku
  narzędzia w czacie (agent i tak dostaje go automatycznie) oraz w panelu Plików nad edytorem po
  Save.
- **Historia wersji:** nowa tabela `file_versions` (migracja `0004_file_versions.sql`) — max 5
  ostatnich wersji na ścieżkę, kolejność po kolumnie `seq` (`serial`), **nie** po `created_at` —
  kilka zapisów w tej samej milisekundzie (typowe w pętli testów / szybkich edycjach) miałyby
  niejednoznaczną kolejność przy sortowaniu po znaczniku czasu.
- **Undo:** `fsRestore` przywraca najnowszą wersję i odkłada bieżącą treść jako nową wersję —
  cofnięcie jest więc odwracalne (drugie „Cofnij” = redo). Przycisk „Cofnij” w panelu Plików
  (`FilesPanel.tsx`), endpointy `GET /api/fs/file/history` i `POST /api/fs/file/restore`.
- **Kontekst:** świadomie **nie** dodano `fs.history`/`fs.restore` jako narzędzi agenta w
  `SYSTEM_PROMPT` — to bezpiecznik dla człowieka w UI, nie kolejny tool zapychający context window
  (zgodnie z decyzją „Agent FS-first” z 2026-09-04). Agent i tak widzi diff automatycznie przy
  każdym `fs.write`.
- **Test:** 174/174 (`deno task test`) — nowe testy w `fs/service_test.ts` (diff, historia, undo,
  redo, brak wersjonowania przy no-op), `fs/routes_test.ts` (HTTP flow), `ai/tools_test.ts` (diff w
  wyjściu narzędzia `fs.write`).
- **Konsekwencje:** `deno task epic:done` przesuwa kolejkę na epik 16 (polish — ostatni w Fazie 4).

## 2026-09-13 — Bez Ollama / lokalnego modelu

- **Decyzja:** usunięto Ollama i „offline slot” / „privacy mode” z roadmapy i dokumentów
  (`AI-dostawcy.md`, `architektura.md`, `bezpieczenstwo.md`, `roadmap.md`, `ui-ux.md`).
- **Kontekst:** jeden użytkownik ma zawsze internet; darmowa kaskada (Gemini/Groq/Z.AI/Mistral)
  wystarcza. Dodatkowy lokalny tor to koszt utrzymania bez realnego zysku.
- **Konsekwencje:** brak trybu offline w produkcie; jeśli kiedyś potrzebny, to osobna decyzja z
  konkretnym powodem, nie „na zapas”.

## 2026-09-13 — Faza 4: Agent Core (Cursor / Claude Code / Codex)

- **Decyzja:** po ukończeniu epików 1–13 (Faza 0–3) następny priorytet to nie nowa domena, tylko
  **dojrzewanie silnika agenta** — żeby ChatGPA faktycznie działało jak Cursor/Claude Code/Codex,
  nie tylko przypominało je z nazwy. Dodano epiki 14–16 do `epics.json` / `plan-implementacji.md`:
  14 (dłuższa/mądrzejsza pętla narzędzi + `fs.grep`), 15 (diff + undo przy `fs.write`), 16 (polish:
  naprawić szumiące 404 przy tworzeniu wątków, manualny przegląd wszystkich paneli).
- **Kontekst:** użytkownik potwierdził wizję — „ultimate Agent for learning, but for me”, wzorowany
  na Cursor/Claude Code/Codex; reszta funkcji z Fazy 3/4 (ROI ranking, `/diff`, weekly review,
  spaced repetition, RAG po książkach) świadomie przesunięta do „Później / someday” w `roadmap.md` —
  nie blokuje „gotowego” produktu.
- **Konsekwencje:** `epic-state.json.current = 14`; `aktualny-prompt.md` wskazuje epik 14 jako
  następny do wklejenia nowemu agentowi.

## 2026-09-13 — Ręczny test end-to-end (dev)

- **Test:** `deno task dev` (Fresh/Vite, :5173), realny chat z pytaniem o plan dnia — agent
  poprawnie rozpoznał niedzielę (brak lekcji), odczytał `~/todo/global.todo` i plan lekcji na
  poniedziałek w 5 rundach narzędzi (`gemini/gemini-3.5-flash`); panel Plików (drzewo `~/`, edycja
  `global.todo` + Save) działa. `deno task test` → 154/154 ok.
- **Znaleziony drobny problem:** `packages/web/lib/threads-api.ts` robi `GET` „czy wątek/wiadomość
  już istnieje” przed `POST` tworzącym — zawsze 404 przy nowej rozmowie, widoczne jako błąd w
  konsoli przeglądarki (nieszkodliwe funkcjonalnie, tylko szum). Do ogarnięcia w epiku 16 (polish),
  niżej priorytet niż FS.
- **Konsekwencje:** epiki 1–13 uznane za faktycznie zweryfikowane działające, nie tylko odhaczone w
  roadmapie.
- **Aktualizacja tego samego dnia:** problem okazał się poważniejszy niż „tylko szum” — patrz „Fix:
  reanimacja wątków czatu” niżej. Sam 404 przy check-then-create nadal kosmetyczny i zostaje w
  epiku 16.

## 2026-09-13 — Epik 14: dłuższa pętla narzędzi + fs.grep

- **Decyzja:** `MAX_TOOL_ROUNDS` 3 → 8 w `chat.ts` i `chat-stream.ts`; `shouldFinalize` już nie ma
  specjalnego przypadku dla `plan.generate` — jedyny twardy limit to ostatnia runda. Model sam
  decyduje kiedy skończyć (brak kolejnych `chatgpa-action` = koniec).
- **Kontekst:** epik 14 z Fazy 4 (`ai-kontekst/plan-implementacji.md`) — agent miał za krótką smycz
  na realne wieloetapowe zadania (czytanie kilku plików, potem decyzja).
- **Nowe narzędzie `fs.grep`:** pełnotekstowe wyszukiwanie po treści plików pod `~/` (ILIKE po
  `file_nodes.content`, opcjonalnie `path` i `limit` 1–50, snippet ±60 znaków wokół trafienia).
  Zaimplementowane w `packages/api/fs/service.ts`, podłączone w `tools.ts` i udokumentowane w
  `system-prompt.ts` — agent ma teraz używać `fs.grep` zamiast zgadywać ścieżkę.
- **Test manualny:** pytanie „znajdź notatkę o fotosyntezie” wykonało `fs.grep` → `fs.list` →
  `fs.grep` (zawężone) → `fs.read` w jednej turze (4 rundy narzędzi) i poprawnie zgłosiło brak
  danych zamiast zmyślać. `deno task test` → 160/160 (dodano `fs/service_test.ts` i test `fs.grep` w
  `tools_test.ts`).
- **Konsekwencje:** `deno task epic:done` po tym wpisie przesuwa kolejkę na epik 15 (diff + undo).

## 2026-09-13 — Samodoskonalenie: ChatGPA → Claude Code

- **Decyzja:** ChatGPA (agent w apce) nie zmienia własnego kodu — zamiast tego dopisuje gotowe do
  wklejenia prompty inżynierskie do `~/dev/dla-claude-code.md` (append, nie nadpisanie), gdy uczeń o
  to poprosi albo agent sam zauważy konkretny błąd/brak w samej aplikacji. Uczeń kopiuje wpis do
  Claude Code w repo.
- **Kontekst:** prośba użytkownika — chce zamkniętą pętlę „ChatGPA zauważa problem w sobie →
  człowiek jednym kopiuj-wklej przekazuje to Claude Code”, bez dawania agentowi w czacie uprawnień
  do edycji kodu repo (poza zakresem produktu, ryzyko).
- **Implementacja:** `~/dev/` w `SEED_DIRECTORIES` (`packages/api/fs/seed.ts`, `SEED_VERSION` 3→4),
  `seedDevPrompt` tworzy plik ze wstępem jeśli brak; konwencja formatu (nagłówek z datą, Kontekst /
  Problem / Propozycja zmiany, `---` między wpisami) w `SYSTEM_PROMPT`.
- **Most Claude Code ↔ wirtualny FS:** `scripts/fs-cli.ts`
  (`deno task fs list|read|write|grep|mkdir|delete`) łączy się do tego samego Postgresa co apka —
  Claude Code czyta/edytuje `~/…` bez `deno task dev`. Dodane do `dla-agenta.md` jako krok 2a:
  sprawdź `~/dev/dla-claude-code.md` na starcie sesji.
- **Test manualny:** wiadomość „zauważyłem brak podglądu Markdown w Notatkach, zapisz to dla Claude
  Code” → agent zrobił `fs.read` + `fs.write` i dopisał poprawnie sformatowany wpis; wpis usunięty
  po teście (był danymi testowymi, nie realnym zgłoszeniem).
- **Konsekwencje:** nowy plik nie jest jeszcze ubrany w panel UI — na razie tylko przez panel Plików
  (edytor tekstu) i `deno task fs read`. Ewentualny dedykowany widok/kopiuj-przycisk to
  nice-to-have.

## 2026-09-13 — Fix: reanimacja wątków czatu (duplicate-key crash)

- **Problem:** ręczny test w przeglądarce ujawnił, że strona czatu wisiała na „Ładowanie historii
  czatów…” z pętlą 404/500 w konsoli. Realna przyczyna: `createThread`/`createMessage`
  (`packages/api/threads/service.ts`) robiły ślepy `INSERT`, a soft-deleted wiersz (np. wątek
  usunięty na innym urządzeniu) nadal zajmuje `id` w kluczu głównym — klient robi `GET` (404, bo
  filtr `isNull(deletedAt)`), więc próbuje `POST` z tym samym id → `duplicate key` → 500 → migracja
  nigdy się nie kończy, retry w kółko przy każdym odświeżeniu.
- **Decyzja:** `createThread` i `createMessage` używają teraz `onConflictDoUpdate` na PK zamiast
  `insert` — reanimują (revive) wiersz przy konflikcie (czyszczą `deletedAt`), tak samo jak
  `fsWrite` już robi dla wirtualnego FS (`fs/service.ts`, decyzja z 2026-09-04). `migrateLocalStore`
  dodatkowo sprawdza istnienie przed insertem, żeby retry po sieciowym błędzie nie był kosztowny ani
  nie zawyżał liczników `threads`/`messages`.
- **Kontekst:** to ta sama klasa buga, którą już raz naprawiono dla `file_nodes` (commit „Revive
  soft-deleted file paths…”) — nie została wtedy przeniesiona na `chat_threads`/`chat_messages`.
- **Test:** nowe testy `createThread revives a soft-deleted id instead of crashing` i
  `migrateLocalStore is retry-safe` w `threads/service_test.ts`; ręcznie potwierdzone w przeglądarce
  — strona ładuje się natychmiast, żadnych 404/500 w konsoli po restarcie serwera. `deno task test`
  → 162/162.
- **Konsekwencje:** cosmetyczny 404 z GET-then-create (osobny, opisany wyżej) zostaje jako
  niżej-priorytetowy polish w epiku 16 — już nie crashuje, tylko trochę zaśmieca konsolę.

## 2026-09-04 — Agent FS-first (Cursor-style tools)

- **Decyzja:** agent runtime widzi tylko `fs.list|read|write|mkdir|delete` + `plan.generate`,
  `calendar.freeSlots`, `web.search`, `calc.eval`, `file.send`. Domain tools (`todo.*`, `notes.*`,
  `memory.*`, `grades.*`, CRUD kalendarza, `timetable.*`) nie są w system prompcie. `.ui` seed:
  wyłącznie calendar + timetable; tworzenie plików/katalogów w UI Files.
- **Kontekst:** zbyt wiele tools zapychało context window; metafora Cursor/Claude Code = codebase.
- **Konsekwencje:** krótszy `system-prompt.ts`; slash nadal otwiera panele bez `.ui`; seed v3
  soft-delete obsolete `.ui`.

## 2026-09-15 — MCP most: Claude Code ↔ ChatGPA live, dwukierunkowo

- **Decyzja:** `packages/api/mcp/server.ts` — MCP stdio server (`@modelcontextprotocol/sdk`)
  cienko owijający `fs/service.ts` (`fsList|Read|Grep|Write|Mkdir|Delete`) jako narzędzia
  `fs_list|read|grep|write|mkdir|delete`. Zarejestrowany dla repo w `.mcp.json` (`deno task mcp`) —
  Claude Code łączy się automatycznie, bez ręcznego `deno task fs …`. Druga strona
  samodoskonalenia: nowy plik `~/dev/od-claude-code.md` (seed v5, `fs/seed.ts`) — Claude Code
  odpisuje tam status po przeczytaniu zgłoszenia; `system-prompt.ts` mówi ChatGPA, żeby go czytała
  (fs.read), gdy uczeń pyta o status zgłoszenia.
- **Kontekst:** prośba użytkownika — chciał, żeby czat ChatGPA i Claude Code mogły „ze sobą
  rozmawiać” jako wspólny projekt (organizacja czasu, nie budowanie kolejnej apki). Istniejący
  most (`scripts/fs-cli.ts`) działał, ale wymagał ręcznego kopiowania promptu do Claude Code i był
  jednokierunkowy.
- **Test:** `deno task test` → 176/176. Ręczny smoke test klientem MCP (`Client` +
  `StdioClientTransport`) — `tools/list` zwraca 6 narzędzi, `fs_read` na `~/dev/dla-claude-code.md`
  i `~/dev/od-claude-code.md` działa na lokalnym DB.
- **Konsekwencje:** `deno check packages/api/mcp/server.ts` zgłasza TS2307 dla podścieżek SDK
  (`server/mcp.js`, `server/stdio.js`) — ograniczenie resolvera typów Deno dla npm-paczek z
  wildcard `exports`, nie błąd runtime (serwer działa, potwierdzone smoke testem); plik celowo
  poza `deno task check`. `scripts/fs-cli.ts` zostaje jako fallback poza sesją MCP.
