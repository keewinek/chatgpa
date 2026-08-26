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

## Oczekujące

- Storage Fazy 1: localStorage vs SQLite vs Postgres od razu?
- Extension w monorepo vs osobne repo?
- Streaming SSE od razu po historii chatów, czy później?
