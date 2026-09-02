# Kalendarz i czas wolny

## Cel

Kalendarz łączy: **Librus** (sprawdziany, prace), **bloki nauki** (AI), **życie prywatne** (lekarz, muzyka).
Agent planuje naukę w **realnych oknach czasowych** — nie zakłada nieskończonego wieczoru.

## Pliki

Jeden plik na miesiąc: `~/calendar/2026-09.cal` ([system-plikow.md](./system-plikow.md)).

## Źródła wydarzeń

| Źródło | Opis |
| ------ | ---- |
| `librus` | Sprawdziany, kartkówki, terminy z syncu |
| `ai` | Bloki `study_block`, przesunięcia po „dziś nie mogę” |
| `manual` | Użytkownik lub agent (lekarz, korepetycje muzyki) |

## Plan lekcji (Librus)

- Wtyczka pobiera **plan lekcji** + **zmiany** ([librus.md](./librus.md))
- Zapis: `~/school/librus/schedule.json`, `timetable-changes.json`
- Agent porównuje snapshoty — przy zmianie aktualizuje kalendarz (z weryfikacją AI, nie ślepy cron)

## Stałe czasowe użytkownika (profil)

Zapis w `~/profile/me.profile`:

| Parametr | Wartość | Uwagi |
| -------- | ------- | ----- |
| `commuteAfterSchoolMinutes` | **60** | Powrót do domu ≈ 1h po końcu lekcji |
| `commuteExtraMinutes` | **30** | Czasem obiad — bufor |
| `studyEndPreferred` | **21:00** | Preferowany koniec nauki |
| `studyEndHard` | **21:30** | Absolutne maximum |
| `showerAndBreakMinutes` | **30** | Po powrocie, przed nauką |
| `notificationAfterSchoolMinutes` | **30** | Powiadomienie 30 min po ostatniej lekcji |

### Przykład dnia szkolnego

```
Ostatnia lekcja kończy:     15:00
Powrót do domu (~):         16:00  (+60 min)
Obiad (opcjonalnie):        +30 min → 16:30
Pryszek / przerwa:          30 min → nauka od ~17:00
Koniec nauki (max):         21:00–21:30
```

Agent liczy **dostępne minuty nauki** = od (powrót + przerwa) do `studyEndPreferred`.

## Wolny czas w planie

- Plan dnia pokazuje: „Masz dziś ~X min na naukę”
- Powiadomienie zawiera ten budżet + listę zadań na dziś
- Przeciążenie → agent rozłoży na wcześniejsze dni (patrz [plan-nauki.md](./plan-nauki.md))

## Integracja Librus — zasady AI

1. Sync dostarcza **surowe dane** — nie nadpisuj ślepo całego kalendarza.
2. Agent / job porównuje: nowe oceny, nowe terminy, zmiana planu lekcji.
3. Przy konflikcie lub niejasności → wpis do short memory + opcjonalnie pytanie użytkownika przy następnym czacie.
4. **Nie psuj** ręcznych wpisów użytkownika (lekarz, muzyka) — merge, nie replace all.

## Tools

| Tool | Opis |
| ---- | ---- |
| `calendar.list` | `{ from, to }` — wydarzenia w zakresie |
| `calendar.add` | nowe wydarzenie |
| `calendar.update` | zmiana / przesunięcie |
| `calendar.freeSlots` | `{ date }` — okna wolne na naukę (uwzględnia profil) |

## UI

- Widok miesiąca / tygodnia / dnia
- Kolor wg `kind`: exam, homework, study_block, personal
- Komenda `/calendar`

## Definition of Done

- [ ] Pliki `.cal` + API
- [ ] Profil czasowy w `me.profile`
- [ ] `calendar.freeSlots` uwzględnia plan lekcji + dojazd
- [ ] Merge wydarzeń z Librus
- [ ] UI kalendarza
