# Powiadomienia

## Cele

- Rano: plan dnia.
- T-3 / T-1 przed sprawdzianem: alert + sugestia bloku nauki.
- Wieczór: retrospektywa / zaległe TODO.
- Po sync Librus: „nowa ocena / nowy termin” (opcjonalnie).

## Kanały (darmowe)

| Kanał           | Kiedy                      | Koszt     |
| --------------- | -------------------------- | --------- |
| In-app banner   | zawsze, gdy otwarte        | 0         |
| Web Push (PWA)  | tło, telefon / desktop     | 0         |
| Discord webhook | jeśli już masz serwer      | 0         |
| E-mail          | tylko darmowy SMTP / pomiń | ostrożnie |

Bez płatnych usług push (OneSignal paid, etc.) — Web Push standard + własny VAPID.

## Plan dnia — format

```
Plan na {data}
1. [25 min] {temat} — ROI wysoki ({powód})
2. [15 min] {praca domowa}
3. [20 min] powtórka przed {termin}
Budżet: {X}/{Y} min
```

Generowany przez AI (Plan mode) + zapis do CalendarEvent `study_block` + TODO.

## Quiet hours

W profilu: nie wysyłaj push w quiet hours (oprócz T-1 rano „dziś sprawdzian”).

## Implementacja (kolejność)

1. In-app / wiadomość systemowa w chacie.
2. Cron lokalny w API (`Deno.cron` / timer) generuje plan.
3. Web Push + service worker.
4. Discord webhook opcjonalnie.
