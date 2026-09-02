# Plan lekcji (timetable)

## Status

**✅ Zaimplementowane** (wrzesień 2026) — klasa **3A**, CXXII LO Warszawa (Staffa 3/5).
Źródło: branch `cursor/timetable-plan-lekcji-d48b` (Cursor Cloud Agent), scalone do `main`.

Docelowo plan może pochodzić z Librus (`~/school/librus/schedule.json`) — na razie **statyczny** w kodzie.

## Co działa

### UI

- Widok **Plan lekcji** w aplikacji (sidebar + przycisk w nagłówku czatu)
- Karta „teraz trwa” / „następna lekcja” / weekend
- Wybór **grup lekcyjnych** (język obcy, angielski, WF, informatyka) — zapis w `localStorage`
- Zakładki dni + lista lekcji + siatka całego tygodnia

### AI

- Plan lekcji wstrzykiwany do **system promptu** (z uwzględnieniem `groupPrefs`)
- Aktualna data, dzień tygodnia i godzina (Warszawa) w kontekście
- Narzędzia:
  - `timetable.today` — plan na dziś
  - `timetable.now` — trwająca lub następna lekcja
  - `timetable.day` — plan na dzień (`args.day`: poniedziałek…piątek)
  - `timetable.full` — pełny tydzień (rzadko potrzebne — jest w prompcie)

### API

- `POST /api/chat` i `/api/chat/stream` przyjmują opcjonalne `groupPrefs` w body
- Klient wysyła preferencje grup z `loadGroupPrefs()` przy każdym requeście

## Gdzie w kodzie

| Co | Ścieżka |
| --- | --- |
| Dane planu + logika | `packages/core/timetable.ts` |
| Data/czas Warszawa | `packages/core/datetime.ts` |
| Eksport typów | `packages/core/mod.ts` |
| UI panelu | `packages/web/islands/TimetablePanel.tsx` |
| Preferencje grup (localStorage) | `packages/web/lib/timetable-storage.ts` |
| Kontekst AI | `packages/api/ai/providers.ts` → `withMemoryContext` |
| Narzędzia | `packages/api/ai/tools.ts` |
| Walidacja `groupPrefs` | `packages/api/validate.ts` |

## Grupy lekcyjne (`GroupPrefs`)

```ts
{
  language: 1 | 2,      // 1 = hiszpański, 2 = niemiecki
  english: 1 | 2,
  pe: 1 | 2,            // WF
  informatics: 1 | 2,
}
```

Domyślnie: wszystkie `1`. Klucz localStorage: `chatgpa:timetable:groups`.

Przy lekcjach z podziałem na grupy (np. dwa języki obce w tym samym slocie) `resolveLesson` wybiera właściwą lekcję wg preferencji.

## Godziny lekcji (`LESSON_SLOTS`)

| Slot | Start | Koniec |
| --- | --- | --- |
| 1 | 08:00 | 08:45 |
| 2 | 08:55 | 09:40 |
| 3 | 09:50 | 10:35 |
| 4 | 10:45 | 11:30 |
| 5 | 11:40 | 12:25 |
| 6 | 12:45 | 13:30 |
| 7 | 13:50 | 14:35 |
| 8 | 14:45 | 15:30 |

`getCurrentLesson()` — status `during` / `before` / `after` / `weekend` + następna lekcja w tygodniu.

## Aktualizacja planu

1. Edytuj `TIMETABLE` i `TIMETABLE_META` w `packages/core/timetable.ts`
2. Uruchom `deno test -A packages/core/timetable_test.ts`
3. (Później) import z Librus zastąpi lub zsynchronizuje ten plik

## Relacja z innymi systemami

| System | Jak używa planu |
| --- | --- |
| [powiadomienia.md](./powiadomienia.md) | Trigger: koniec ostatniej lekcji + 30 min → na razie licz z `LESSON_SLOTS` + `getDayLessons` |
| [kalendarz.md](./kalendarz.md) | Wolne okna nauki po ostatniej lekcji dnia |
| [librus.md](./librus.md) | Docelowy sync zastąpi statyczny `TIMETABLE` |
| [prompty.md](./prompty.md) | Wyjątek od „lazy context” — plan jest w prompcie (świadomie, bo często potrzebny) |

## Definition of Done (obecna implementacja)

- [x] UI planu tygodnia z grupami
- [x] AI zna plan i aktualny czas
- [x] Tools `timetable.*`
- [x] `groupPrefs` sync UI ↔ API
- [ ] Eksport do `~/school/schedule.json` (Faza 2 — system plików)
- [ ] Sync z Librus (Faza 3)
