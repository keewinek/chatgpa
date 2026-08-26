# ChatGPA — AI Kontekst

Folder z żywym kontekstem projektu. Tu zapisujemy wizję, decyzje i pomysły, żeby agent i człowiek
mieli wspólne źródło prawdy.

> **Zasada nr 1:** wszystko ma być **darmowe**. Zero płatności. Zero karty. AI tylko z darmowych
> tierów / darmowych kluczy API.

## Jak czytać (dla agenta)

1. Najpierw ten plik + [dla-agenta.md](./dla-agenta.md).
2. Potem [wizja.md](./wizja.md) i [zasady.md](./zasady.md).
3. Przed kodem AI: [AI-dostawcy.md](./AI-dostawcy.md) + [prompty.md](./prompty.md).
4. Przed UI: [ui-ux.md](./ui-ux.md).
5. Przed danymi / sync: [model-danych.md](./model-danych.md), [librus.md](./librus.md).

## Pliki

| Plik                                     | O czym                                         |
| ---------------------------------------- | ---------------------------------------------- |
| [dla-agenta.md](./dla-agenta.md)         | Jak agent ma pracować z tym repo               |
| [wizja.md](./wizja.md)                   | Czym jest ChatGPA — „Cursor do szkoły”         |
| [zasady.md](./zasady.md)                 | Twarde reguły produktu i techniczne            |
| [funkcje.md](./funkcje.md)               | Moduły, automatyzacje, systemy                 |
| [tryby-agenta.md](./tryby-agenta.md)     | Ask / Plan / Agent / Focus jak w Cursorze      |
| [architektura.md](./architektura.md)     | Stack Deno, monorepo, przepływy                |
| [model-danych.md](./model-danych.md)     | Encje: profil, oceny, TODO, wiedza             |
| [AI-dostawcy.md](./AI-dostawcy.md)       | Kaskada darmowych modeli (mądry → głupi)       |
| [prompty.md](./prompty.md)               | System prompt, packing kontekstu               |
| [ui-ux.md](./ui-ux.md)                   | Chat-first UI, panele, PWA                     |
| [librus.md](./librus.md)                 | Integracja z Librusem (wtyczka / sync)         |
| [powiadomienia.md](./powiadomienia.md)   | Plan dnia, alerty, Web Push                    |
| [bezpieczenstwo.md](./bezpieczenstwo.md) | Klucze, dane szkolne, prywatność               |
| [decyzje.md](./decyzje.md)               | Log decyzji (ADR-lite)                         |
| [glosariusz.md](./glosariusz.md)         | Słownik pojęć                                  |
| [roadmap.md](./roadmap.md)               | Co robimy teraz / potem                        |
| [pomysly.md](./pomysly.md)               | Backlog pomysłów (niezacommitowane do scope)   |

## Szybka esencja

ChatGPA to osobisty system edukacyjny: chat jak ChatGPT + planer dnia + tracker nauki + kontekst ze
szkoły (Librus) + kalendarz + TODO. Backend i frontend w Deno. AI router próbuje wiele darmowych
dostawców, zawsze od najmądrzejszego modelu do najgłupszego, aż coś odpowie. Pod odpowiedzią widać,
który model został użyty.

## Stan Fazy 0 (zrobione)

- Chat UI (Fresh island) + badge modelu
- `POST /api/chat` + `GET /api/ai/models`
- Kaskada Gemini / Groq / OpenRouter
- Ten folder kontekstu
