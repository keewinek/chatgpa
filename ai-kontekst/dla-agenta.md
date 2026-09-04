# Dla agenta kodującego

Instrukcje dla AI (Cursor / Copilot / ChatGPA w przyszłości), które pracuje w tym repo.

## Zawsze

1. Trzymaj **koszt = 0 zł**. Nie proponuj płatnych API, SaaS ani „pro” planów jako wymaganych.
2. Czytaj `ai-kontekst/` przed większą zmianą — to źródło prawdy ponad luźną rozmową.
3. Kod w Deno monorepo: `packages/core`, `packages/api`, `packages/web`.
4. Po zmianach: `deno task test` (i sensowny check pakietu, którego dotyczy zmiana).
5. Branch: pracuj na `main`; **nigdy nie pushuj na `prod`** bez wyraźnej prośby.
6. Commit + push po zmianach (reguła użytkownika), message po angielsku, konkretny.
7. **Po zakończeniu epiku z plan-implementacji:** `deno task epic:done` — **obowiązkowe**, przed
   końcem sesji. Nie edytuj ręcznie `aktualny-prompt.md`.

## Priorytety produktowe

1. Chat musi **zawsze** działać (kaskada fallback).
2. Transparentność modelu (`provider/model` w UI i API).
3. **File-first OS** — nowe funkcje jako pliki pod `~/` ([system-plikow.md](./system-plikow.md));
   agent runtime ma świadomie używać `fs.*`.
4. Kontekst ucznia / szkoły rośnie z czasem — nie hardcoduj fikcyjnych ocen.
5. Librus = osobny tor (wtyczka), nie blokuj chatu na syncu.

## Czego nie robić

- Nie dodawaj płatnych modeli „bo lepsze”.
- Nie wysyłaj kluczy API do frontendu.
- Nie commituj `.env`.
- Nie buduj multi-tenant SaaS / auth Google / billing „na zapas”.
- Nie rozwalaj prostoty Fazy 0 (jeden chat) bez potrzeby.

## Gdzie co jest w kodzie

| Temat            | Ścieżka                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| Kaskada AI       | `packages/api/ai/`                                                      |
| Narzędzia / chat | `packages/api/ai/chat.ts`, `tools.ts`                                   |
| Endpointy chat   | `packages/api/app.ts`                                                   |
| UI chatu         | `packages/web/islands/ChatApp.tsx`                                      |
| Markdown         | `packages/web/islands/MarkdownBody.tsx`                                 |
| Historia/pamięć  | `packages/web/lib/chat-storage.ts`                                      |
| Plan lekcji      | `packages/core/timetable.ts`, `packages/web/islands/TimetablePanel.tsx` |
| Grupy lekcyjne   | `packages/web/lib/timetable-storage.ts`                                 |
| Style            | `packages/web/assets/styles.css`                                        |
| Typy shared      | `packages/core/types.ts`                                                |
| Env przykładowy  | `.env.example`                                                          |

## Plan wieloepikowy (Faza 2+)

Przed większą funkcją przeczytaj [plan-implementacji.md](./plan-implementacji.md). **Aktualny prompt
do wklejenia:** [aktualny-prompt.md](./aktualny-prompt.md) (auto po `deno task epic:done`). Jeden
agent = jeden epik (np. tylko DB, tylko FS, tylko pamięć). Nie implementuj wszystkiego naraz.

| Epik          | Plik kontekstu                         |
| ------------- | -------------------------------------- |
| Serwer + DB   | [serwer-i-sync.md](./serwer-i-sync.md) |
| System plików | [system-plikow.md](./system-plikow.md) |
| Pamięć        | [pamiec.md](./pamiec.md)               |
| TODO          | [todo.md](./todo.md)                   |
| Notatki       | [notatki.md](./notatki.md)             |
| Kalendarz     | [kalendarz.md](./kalendarz.md)         |
| Plan nauki    | [plan-nauki.md](./plan-nauki.md)       |
| Powiadomienia | [powiadomienia.md](./powiadomienia.md) |
| Komendy       | [komendy.md](./komendy.md)             |
| Lazy prompty  | [prompty.md](./prompty.md)             |

## Jak aktualizować kontekst

Gdy podejmiesz decyzję architektoniczną → dopisz wpis do [decyzje.md](./decyzje.md). Gdy dodasz
feature → zaktualizuj [roadmap.md](./roadmap.md). Gdy zmienisz listę modeli → zsynchronizuj
[AI-dostawcy.md](./AI-dostawcy.md) z `MODEL_CASCADE`.
