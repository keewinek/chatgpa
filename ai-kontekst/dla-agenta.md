# Dla agenta kodującego

Instrukcje dla AI (Cursor / Copilot / ChatGPA w przyszłości), które pracuje w tym repo.

## Zawsze

1. Trzymaj **koszt = 0 zł**. Nie proponuj płatnych API, SaaS ani „pro” planów jako wymaganych.
2. Czytaj `ai-kontekst/` przed większą zmianą — to źródło prawdy ponad luźną rozmową.
3. Kod w Deno monorepo: `packages/core`, `packages/api`, `packages/web`.
4. Po zmianach: `deno task test` (i sensowny check pakietu, którego dotyczy zmiana).
5. Branch: pracuj na `main`; **nigdy nie pushuj na `prod`** bez wyraźnej prośby.
6. Commit + push po zmianach (reguła użytkownika), message po angielsku, konkretny.

## Priorytety produktowe

1. Chat musi **zawsze** działać (kaskada fallback).
2. Transparentność modelu (`provider/model` w UI i API).
3. Kontekst ucznia / szkoły rośnie z czasem — nie hardcoduj fikcyjnych ocen.
4. Librus = osobny tor (wtyczka), nie blokuj chatu na syncu.

## Czego nie robić

- Nie dodawaj płatnych modeli „bo lepsze”.
- Nie wysyłaj kluczy API do frontendu.
- Nie commituj `.env`.
- Nie buduj multi-tenant SaaS / auth Google / billing „na zapas”.
- Nie rozwalaj prostoty Fazy 0 (jeden chat) bez potrzeby.

## Gdzie co jest w kodzie

| Temat            | Ścieżka                                 |
| ---------------- | --------------------------------------- |
| Kaskada AI       | `packages/api/ai/`                      |
| Narzędzia / chat | `packages/api/ai/chat.ts`, `tools.ts`   |
| Endpointy chat   | `packages/api/app.ts`                   |
| UI chatu         | `packages/web/islands/ChatApp.tsx`      |
| Markdown         | `packages/web/islands/MarkdownBody.tsx` |
| Historia/pamięć  | `packages/web/lib/chat-storage.ts`      |
| Style            | `packages/web/assets/styles.css`        |
| Typy shared      | `packages/core/types.ts`                |
| Env przykładowy  | `.env.example`                          |

## Jak aktualizować kontekst

Gdy podejmiesz decyzję architektoniczną → dopisz wpis do [decyzje.md](./decyzje.md). Gdy dodasz
feature → zaktualizuj [roadmap.md](./roadmap.md). Gdy zmienisz listę modeli → zsynchronizuj
[AI-dostawcy.md](./AI-dostawcy.md) z `MODEL_CASCADE`.
