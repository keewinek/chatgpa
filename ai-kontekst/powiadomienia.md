# Powiadomienia

## Cele (zaktualizowane)

1. **Po szkole** — 30 min po ostatniej lekcji: plan na dziś + wiadomość agenta + TODO dziś + budżet wolnego czasu.
2. **Anty-prokrastynacja** — T-7 / T-3 / T-1 przed sprawdzianem (małe kroki, nie panika w czwartek).
3. **Kliknięcie** — otwiera czat jakby agent napisał pierwszy; możliwość negocjacji („dziś lekarz”).
4. Rano (opcjonalnie): krótki plan dnia jeśli nie wysłano po szkole.
5. Po sync Librus: nowa ocena / nowy termin (opcjonalnie).

Szczegóły planu nauki: [plan-nauki.md](./plan-nauki.md).

## Kanały (darmowe)

| Kanał           | Kiedy                      | Koszt     |
| --------------- | -------------------------- | --------- |
| In-app banner   | zawsze, gdy otwarte        | 0         |
| Nowy czat       | klik w powiadomienie       | 0         |
| Web Push (PWA)  | tło, telefon / desktop     | 0         |
| Discord webhook | jeśli już masz serwer      | 0         |

Bez płatnych usług push — Web Push standard + własny VAPID.

## Powiadomienie po szkole — specyfikacja

### Trigger

```
ostatnia_lekcja_koniec(dziś) + 30 minut
```

Źródło czasu (kolejność):

1. **Teraz:** `packages/core/timetable.ts` — `getDayLessons` + `LESSON_SLOTS` (plan 3A, patrz [plan-lekcji.md](./plan-lekcji.md))
2. **Docelowo:** `~/school/librus/schedule.json` (plan lekcji z wtyczki)

Fallback: brak planu → stała godzina z profilu lub brak push (tylko wieczorny plan).

### Payload

```ts
{
  id: string
  kind: "daily_plan" | "exam_alert" | "librus_update"
  title: string                    // np. "Plan na wtorek"
  body: string                     // skrót wiadomości agenta
  chatPrefill: {                   // otwarcie czatu
    role: "assistant"
    content: string               // pełna wiadomość agenta (markdown)
  }
  todoToday: Task[]               // scheduledFor === dziś
  freeMinutes: number             // z calendar.freeSlots
  createdAt: string
  readAt?: string
}
```

### UX po kliknięciu

1. Otwórz nowy wątek (lub wątek „Dziś — {data}”).
2. Pierwsza wiadomość = `chatPrefill.content` (asystent).
3. Panel / embed: lista TODO na dziś + „~X min wolnej nauki”.
4. Composer gotowy — użytkownik odpowiada („mam muzykę”).

## Alerty sprawdzianowe

| Offset | Treść |
| ------ | ----- |
| T-7 | „Za tydzień {przedmiot} — dziś 15–20 min powtórki” + zadanie w TODO |
| T-3 | „Za 3 dni sprawdzian — zaplanowano {N} min w tym tygodniu” |
| T-1 rano | „Jutro sprawdzian z {przedmiot} — checklista” |

Generowane przez cron + wąski prompt AI (patrz [plan-nauki.md](./plan-nauki.md)).

## Quiet hours

Z profilu (`studyEndHard` = 21:30): nie wysyłaj **push** po tej godzinie.
Wyjątek: T-1 rano (7:00–8:00) „dziś sprawdzian”.

## Plan dnia — format wiadomości agenta

```
Cześć! Wróciłeś ze szkoły — oto plan na **{dzień}, {data}**.

Masz ok. **{freeMinutes} min** na naukę (do ~21:00).

### Na dziś
1. [25 min] Chemia — kwasy *(sprawdzian za 5 dni)*
2. [20 min] Matma — zadania domowe

Jeśli coś Ci dziś nie pasuje (lekarz, zajęcia), napisz — przesunę na inny dzień.
```

## Implementacja (kolejność)

1. Tabela `notifications` + in-app lista
2. Cron + integracja z planem dziennym (`/api/plan/generate`)
3. Otwarcie czatu z prefill
4. Web Push + service worker
5. Discord webhook opcjonalnie

## Definition of Done

- [ ] Powiadomienie 30 min po ostatniej lekcji
- [ ] Klik → czat z wiadomością agenta
- [ ] TODO dziś + budżet minut w UI powiadomienia
- [ ] T-7 alert przed sprawdzianem
- [ ] Web Push na telefonie (PWA)
