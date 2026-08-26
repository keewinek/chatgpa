# ChatGPA — AI Kontekst

Folder z żywym kontekstem projektu. Tu zapisujemy wizję, decyzje i pomysły, żeby agent i człowiek
mieli wspólne źródło prawdy.

> **Zasada nr 1:** wszystko ma być **darmowe**. Zero płatności. Zero karty. AI tylko z darmowych
> tierów / darmowych kluczy API.

## Pliki

| Plik                                 | O czym                                   |
| ------------------------------------ | ---------------------------------------- |
| [wizja.md](./wizja.md)               | Czym jest ChatGPA — „Cursor do szkoły”   |
| [funkcje.md](./funkcje.md)           | Moduły, automatyzacje, systemy           |
| [architektura.md](./architektura.md) | Stack Deno, monorepo, przepływy          |
| [AI-dostawcy.md](./AI-dostawcy.md)   | Kaskada darmowych modeli (mądry → głupi) |
| [librus.md](./librus.md)             | Integracja z Librusem (osobny tor)       |
| [roadmap.md](./roadmap.md)           | Co robimy teraz / potem                  |

## Szybka esencja

ChatGPA to osobisty system edukacyjny: chat jak ChatGPT + planer dnia + tracker nauki + kontekst ze
szkoły (Librus) + kalendarz + TODO. Backend i frontend w Deno. AI router próbuje wiele darmowych
dostawców, zawsze od najmądrzejszego modelu do najgłupszego, aż coś odpowie. Pod odpowiedzią widać,
który model został użyty.
