# ChatGPA — AI Kontekst

Folder z żywym kontekstem projektu. Tu zapisujemy wizję, decyzje i pomysły, żeby agent i człowiek
mieli wspólne źródło prawdy.

> **Zasada nr 1:** wszystko ma być **darmowe**. Zero płatności. Zero karty. AI tylko z darmowych
> tierów / darmowych kluczy API.
>
> **Zasada nr 2 (file-first):** szkoła = jeden codebase pod `~/`. Agent jak Cursor: `fs.*`, nie
> milion toolsów domenowych. Szczegóły: [system-plikow.md](./system-plikow.md).

## Jak czytać (dla agenta)

1. Ten plik + [dla-agenta.md](./dla-agenta.md).
2. **Plan pracy:** [plan-implementacji.md](./plan-implementacji.md) — fazy + prompty do wklejenia.
3. [wizja.md](./wizja.md) i [zasady.md](./zasady.md).
4. Przed kodem AI: [AI-dostawcy.md](./AI-dostawcy.md), [prompty.md](./prompty.md).
5. Przed danymi / sync: [serwer-i-sync.md](./serwer-i-sync.md),
   [system-plikow.md](./system-plikow.md).
6. Przed Librus: [librus.md](./librus.md).

## Pliki — rdzeń

| Plik                                             | O czym                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| [dla-agenta.md](./dla-agenta.md)                 | Jak agent ma pracować z tym repo                      |
| [plan-implementacji.md](./plan-implementacji.md) | Fazy, zależności — sekcja na górze auto z `epic:done` |
| [aktualny-prompt.md](./aktualny-prompt.md)       | **👉 Skopiuj ten plik do nowego agenta**              |
| [wizja.md](./wizja.md)                           | Czym jest ChatGPA — „Cursor do szkoły”                |
| [zasady.md](./zasady.md)                         | Twarde reguły produktu i techniczne                   |
| [architektura.md](./architektura.md)             | Stack Deno, monorepo, przepływy                       |
| [roadmap.md](./roadmap.md)                       | Checklist faz                                         |
| [decyzje.md](./decyzje.md)                       | Log decyzji (ADR-lite)                                |

## Pliki — funkcje (Faza 2+)

| Plik                                   | O czym                                    |
| -------------------------------------- | ----------------------------------------- |
| [pamiec.md](./pamiec.md)               | Short-term + long-term memory             |
| [komendy.md](./komendy.md)             | Slash commands (`/plan`, `/pomodoro`, …)  |
| [system-plikow.md](./system-plikow.md) | Metafora OS — pliki, rozszerzenia, `fs.*` |
| [todo.md](./todo.md)                   | Globalna lista zadań                      |
| [notatki.md](./notatki.md)             | Notatki Markdown na serwerze              |
| [serwer-i-sync.md](./serwer-i-sync.md) | PostgreSQL, sync telefon ↔ komputer       |
| [kalendarz.md](./kalendarz.md)         | Kalendarz, czas wolny, profil czasu       |
| [plan-nauki.md](./plan-nauki.md)       | Plan dnia, anty-prokrastynacja, T-7       |
| [powiadomienia.md](./powiadomienia.md) | Push po szkole, klik → czat               |
| [librus.md](./librus.md)               | Wtyczka + sync ocen / planu lekcji        |
| [plan-lekcji.md](./plan-lekcji.md)     | **Plan 3A — zaimplementowany** (UI + AI)  |

## Pliki — AI i UI

| Plik                                     | O czym                                       |
| ---------------------------------------- | -------------------------------------------- |
| [model-danych.md](./model-danych.md)     | Encje: profil, oceny, TODO, pamięć, FS       |
| [prompty.md](./prompty.md)               | Lazy context — tools zamiast pełnego pakietu |
| [tryby-agenta.md](./tryby-agenta.md)     | Ask / Plan / Agent / Focus                   |
| [AI-dostawcy.md](./AI-dostawcy.md)       | Kaskada darmowych modeli                     |
| [ui-ux.md](./ui-ux.md)                   | Chat-first UI, panele, PWA                   |
| [bezpieczenstwo.md](./bezpieczenstwo.md) | Klucze, dane szkolne, prywatność             |

## Szybka esencja

ChatGPA to osobisty **OS do szkoły**: chat + system plików (`~/todo`, `~/notes`, `~/calendar`, …) +
pamięć (krótka/długa) + plan nauki + Librus + powiadomienia po szkole. Wszystko na serwerze z sync
między urządzeniami. AI pobiera kontekst przez **tools**, nie dostaje wszystkiego w prompcie.

## Stan (wrzesień 2026)

**Zrobione:** chat, streaming, kaskada AI, pamięć v1 (localStorage), załączniki, narzędzia
`memory.*`, **plan lekcji 3A** (UI + AI).

**Następne (wg [plan-implementacji.md](./plan-implementacji.md)):** serwer + DB → system plików →
pamięć short/long → lazy context → TODO/notatki → kalendarz → Librus → powiadomienia.
