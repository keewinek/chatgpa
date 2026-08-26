# Funkcje, systemy, automatyzacje

## Faza 0 — Chat AI ✅

- UI w stylu ChatGPT (lista wiadomości + input).
- Backend `/api/chat` z kaskadą darmowych modeli.
- Wyświetlanie użytego modelu pod odpowiedzią.
- Fallback smart → dumb, żeby zawsze coś odpowiedziało.
- Status skonfigurowanych slotów w headerze.

## Faza 1 — Rdzeń osobisty

| Moduł              | Co robi                                          | Priorytet |
| ------------------ | ------------------------------------------------ | --------- |
| **Profil ucznia**  | Imię, klasa, cele (np. średnia 4.75), styl nauki | P0        |
| **Przedmioty**     | Lista, wagi, target średniej                     | P0        |
| **TODO**           | Lista zadań z priorytetem ROI                    | P0        |
| **Kalendarz**      | Sprawdziany, prace, bloki nauki                  | P0        |
| **Plan dnia**      | Generowany AI na podstawie kontekstu + TODO      | P1        |
| **Tracker wiedzy** | Co umiesz / nie umiesz (tematy, kartkówki)       | P1        |
| **Historia chatów**| Wątki, localStorage → DB                         | P1        |

## Faza 2 — Kontekst szkoły (Librus)

Zobacz [librus.md](./librus.md). ChatGPA ma znać:

- oceny i wagi,
- terminy prac / sprawdzianów,
- zadania domowe,
- frekwencję (opcjonalnie),
- wiadomości od nauczycieli (jeśli dostępne).

## Faza 3 — Nauka jak Cursor

Zobacz też [tryby-agenta.md](./tryby-agenta.md).

1. **Ask** — „wyjaśnij mi to zadanie z fizyki”.
2. **Plan** — „ułóż plan powtórki przed sprawdzianem z historii”.
3. **Agent** — „przygotuj 10 pytań egzaminacyjnych z moich notatek”.
4. **Inline help** — podpowiedzi przy rozwiązywaniu (bez zdradzania odpowiedzi od razu).
5. **Diff wiedzy** — „co zmieniło się w mojej średniej od tygodnia”.
6. **Focus** — sesja pomodoro wokół jednego tematu + quiz.

## Automatyzacje w tle

| Automatyzacja     | Trigger                          | Efekt                                       | Faza |
| ----------------- | -------------------------------- | ------------------------------------------- | ---- |
| Plan dnia         | rano / na żądanie                | wiadomość + wpisy w kalendarzu/TODO         | 1    |
| Alert terminu     | T-3 / T-1 dni przed sprawdzianem | powiadomienie + sugestia bloku nauki        | 2    |
| Sync Librus       | okresowo (wtyczka)               | świeże oceny i zadania                      | 2    |
| Retrospektywa     | wieczór                          | co zrobione, co zaległe                     | 1    |
| ROI priorytety    | po sync ocen                     | ranking: gdzie godzina nauki daje najwięcej | 2    |
| Spaced repetition | wg tracker wiedzy                | przypomnienia powtórek                      | 3    |
| Quiet hours       | wieczór przed kartkówką          | mniej rozpraszaczy, fokus plan              | 3    |
| Weekly review     | niedziela                        | plan tygodnia + luki                        | 2    |

## Systemy wewnętrzne (docelowo)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Chat UI     │────▶│ AI Cascade   │────▶│ Gemini / Groq / │
│ (Fresh)     │◀────│ (Hono API)   │◀────│ OpenRouter / …  │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │ Context Hub  │  profil · Librus · TODO · notes · pamięć wątku
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      Calendar          Tracker       Automations
      + TODO            wiedzy        (cron / push)
```

## Narzędzia, które AI może wywołać (plan)

Gdy dojdzie tool-calling (nawet uproszczone JSON tools):

| Tool              | Opis                                      |
| ----------------- | ----------------------------------------- |
| `todo.add`        | Dodaj zadanie                             |
| `todo.complete`   | Odhacz                                    |
| `calendar.add`    | Blok nauki / wydarzenie                   |
| `plan.today`      | Wygeneruj i zapisz plan dnia              |
| `knowledge.mark`  | Oznacz temat: umiem / słabo / nie umiem   |
| `librus.summary`  | Podsumowanie ocen / terminów z snapshotu  |
| `quiz.generate`   | Pytania z tematu / notatek                |

Bez prawdziwego function-calling: AI zwraca blok ` ```chatgpa-action` ` parsowany po stronie API.

## Powiadomienia

Zobacz [powiadomienia.md](./powiadomienia.md).

## Czego NIE robimy na start

- Płatne modele jako zależność.
- Multi-user SaaS / billing.
- Produkt „dla szkoły jako instytucji”.
- Pełny LMS / dziennik zastępujący Librus.
