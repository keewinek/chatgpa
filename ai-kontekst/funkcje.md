# Funkcje, systemy, automatyzacje

## Faza 0 — Chat AI (teraz)

- UI w stylu ChatGPT (lista wiadomości + input).
- Backend `/api/chat` z kaskadą darmowych modeli.
- Wyświetlanie użytego modelu pod odpowiedzią.
- Fallback smart → dumb, żeby zawsze coś odpowiedziało.

## Faza 1 — Rdzeń osobisty

| Moduł              | Co robi                                          |
| ------------------ | ------------------------------------------------ |
| **Profil ucznia**  | Imię, klasa, cele (np. średnia 4.75), styl nauki |
| **Przedmioty**     | Lista, wagi, target średniej                     |
| **Tracker wiedzy** | Co umiesz / nie umiesz (tematy, kartkówki)       |
| **TODO**           | Lista zadań z priorytetem ROI                    |
| **Kalendarz**      | Sprawdziany, prace, bloki nauki                  |
| **Plan dnia**      | Generowany AI na podstawie Librusa + TODO        |

## Faza 2 — Kontekst szkoły (Librus)

Zobacz [librus.md](./librus.md). ChatGPA ma znać:

- oceny i wagi,
- terminy prac / sprawdzianów,
- frekwencję (opcjonalnie),
- wiadomości od nauczycieli (jeśli dostępne).

## Faza 3 — Nauka jak Cursor

Pomysły „Cursor features” przeniesione na szkołę:

1. **Ask** — „wyjaśnij mi to zadanie z fizyki”.
2. **Plan** — „ułoż plan powtórki przed sprawdzianem z historii”.
3. **Agent** — „przygotuj 10 pytań egzaminacyjnych z moich notatek”.
4. **Inline help** — podpowiedzi przy rozwiązywaniu zadań (bez zdradzania odpowiedzi od razu).
5. **Diff wiedzy** — „co zmieniło się w mojej średniej od tygodnia”.

## Automatyzacje w tle

| Automatyzacja     | Trigger                          | Efekt                                       |
| ----------------- | -------------------------------- | ------------------------------------------- |
| Plan dnia         | rano / na żądanie                | wiadomość + wpisy w kalendarzu/TODO         |
| Alert terminu     | T-3 / T-1 dni przed sprawdzianem | powiadomienie + sugestia bloku nauki        |
| Sync Librus       | okresowo (wtyczka)               | świeże oceny i zadania                      |
| Retrospektywa     | wieczór                          | co zrobione, co zaległe                     |
| ROI priorytety    | po sync ocen                     | ranking: gdzie godzina nauki daje najwięcej |
| Spaced repetition | wg tracker wiedzy                | przypomnienia powtórek                      |
| Quiet hours       | wieczór przed kartkówką          | mniej rozpraszaczy, fokus plan              |

## Systemy wewnętrzne

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Chat UI     │────▶│ AI Cascade   │────▶│ Gemini / Groq / │
│ (Fresh)     │◀────│ (Hono API)   │◀────│ OpenRouter / …  │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │ Context Hub  │  (profil, Librus, TODO, notes)
                    └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Calendar       Tracker      Automations
```

## Powiadomienia (później)

- Web Push (PWA) — plan dnia, alerty terminów.
- Opcjonalnie Discord webhook / e-mail — tylko jeśli darmowe.

## Czego NIE robimy na start

- Płatne modele (GPT-4 płatny, Claude płatny, etc.).
- Multi-user SaaS / billing.
- Synchroniczna produkcja „dla szkoły jako instytucji” — to narzędzie osobiste.
