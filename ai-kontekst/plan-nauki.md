# Plan nauki, powiadomienia i anty-prokrastynacja

## Problem użytkownika

Sprawdzian w piątek → cały tydzień nic → czwartek panika. **ChatGPA ma to łamać:**

- Tydzień wcześniej: „Za tydzień sprawdzian z X — zacznij dziś 20 min”
- Codziennie: małe zadania zamiast jednego wielkiego bloku
- Po szkole: powiadomienie z planem na dziś + możliwość negocjacji („mam lekarza”)

## Powiadomienie po szkole

### Kiedy

**30 minut po zakończeniu ostatniej lekcji** danego dnia — wg planu lekcji z Librus
(`schedule.json`).

Jeśli brak planu → fallback: stała godzina z profilu lub brak push (tylko wieczorny plan).

### Treść

1. **Wiadomość od agenta** (jak pierwsza wiadomość w nowym czacie)
2. **TODO na dziś** (`scheduledFor === dziś`)
3. **Budżet czasu:** „~90 min wolnej nauki (17:00–21:00)”
4. Opcjonalnie: przypomnienie o sprawdzianie za N dni

### Kliknięcie

Otwiera **nowy czat** (lub dedykowany wątek „Plan dnia”) z już wyświetloną wiadomością asystenta.
Użytkownik odpowiada naturalnie:

> „Dziś mam korepetycje muzyki, nie dam rady matmy”

Agent:

1. `calendar.add` — muzyka dziś
2. `todo.update` — przenieś matmę na jutro / pojutrze
3. `memory.remember` (short) — „wtorki muzyka” jeśli powtarzalne
4. Przelicza plan tygodnia — **równomierne** rozłożenie, nie wszystko na czwartek

## Plan tygodniowy (proaktywny)

| Moment              | Akcja                                             |
| ------------------- | ------------------------------------------------- |
| T-7 do sprawdzianu  | Powiadomienie + małe zadanie (15–20 min)          |
| T-3                 | Alert + większy blok w planie                     |
| T-1                 | Przypomnienie + checklista                        |
| Każdy dzień szkolny | Plan po szkole (30 min po lekcjach)               |
| Niedziela wieczór   | `/plan tydzień` — przegląd nadchodzącego tygodnia |

## Generowanie planu dziennego

Wejścia (agent pobiera toolsami, **nie** z pełnego promptu):

- `todo.list({ scheduledFor: dziś })`
- `calendar.list({ from, to })` — terminy, zajęcia
- `calendar.freeSlots({ date: dziś })`
- `school/librus/grades.json` — ROI per przedmiot
- `memory.list({ kind: "long" })` — preferencje
- Plan lekcji — czy dziś szkoła

Wyjścia:

- Zaktualizowane `Task` z `scheduledFor`
- Wpisy `study_block` w `.cal`
- Plik `~/plans/2026-09-02.plan`
- Treść wiadomości do powiadomienia

## Format planu dnia (`.plan`)

```markdown
# Plan — 2026-09-02 (wtorek)

Budżet: 85 / 90 min nauki

## Bloki

1. 17:15–17:40 (25 min) — Chemia: kwasy (ROI: sprawdzian za 5 dni)
2. 18:00–18:20 (20 min) — Matma: zadania domowe
3. 19:30–19:50 (20 min) — Powtórka fiszek historii

## Uwagi

- Po 21:00 tylko lekka powtórka jeśli zostanie energia.
```

## Równomierność

Algorytm (wysokopoziomowo):

1. Zbierz wszystkie terminy w horyzoncie 14 dni.
2. Dla każdego sprawdzianu rozłóż `estimatedMinutes` na dni **od T-7 do T-1**.
3. Dziennie nie przekraczaj `freeSlots` ani budżetu z profilu.
4. Przy „dziś nie mogę” — przesuń tylko dzisiejsze bloki, nie kasuj całego tygodnia.
5. ROI: wyższa waga oceny + bliższy termin → wyższy priorytet.

## Kanały powiadomień

Szczegóły techniczne: [powiadomienia.md](./powiadomienia.md).

Kolejność:

1. In-app (banner + nowy czat)
2. Web Push (PWA, telefon)
3. Discord webhook (opcjonalnie)

## Background jobs

Na serwerze (`Deno.cron`):

| Cron            | Job                                                           |
| --------------- | ------------------------------------------------------------- |
| Codziennie rano | Przelicz plan jeśli brak; alert T-1                           |
| Po sync Librus  | Merge kalendarza + odśwież ROI                                |
| Co godzinę      | Wyślij zaplanowane powiadomienia (30 min po ostatniej lekcji) |
| Codziennie 3:00 | Cleanup wygasłej short memory                                 |

**AI w pętli:** job przygotowuje dane → **jeden** call do cascade z wąskim promptem „wygeneruj
plan/wiadomość” → zapis wyniku. Nie pełny chat context.

## Definition of Done

- [ ] Powiadomienie 30 min po ostatniej lekcji
- [ ] Klik → czat z wiadomością agenta + TODO dziś
- [ ] Negocjacja dnia (lekarz/muzyka) → przesunięcie planu
- [ ] T-7 alert przed sprawdzianem
- [ ] Pliki `.plan` generowane automatycznie
- [ ] Budżet minut widoczny w powiadomieniu
