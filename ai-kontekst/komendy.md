# System komend (slash commands)

## Cel

Użytkownik wpisuje `/komenda` w composerze czatu → aplikacja wykonuje akcję UI lub wysyła seed
prompt do AI. Komendy to skróty do częstych akcji — jak w Slacku / Discordzie / Cursorze.

## Parsowanie

```
/pomodoro              → akcja UI (bez wysyłania do AI)
/clear short memory    → akcja API + potwierdzenie w czacie
/plan                  → seed prompt + wysłanie do AI
/quiz chemia           → seed prompt z argumentem
```

### Reguły

1. Komenda zaczyna się od `/` na początku wiadomości (lub po białych znakach — do ustalenia).
2. Argumenty po spacji: `/quiz [temat]`, `/note otwórz [nazwa]`.
3. Autocomplete w composerze przy wpisywaniu `/` (lista + opis).
4. Nieznana komenda → zwykła wiadomość do AI (nie blokuj użytkownika).

## Kategorie komend

### A — Akcje UI (bez AI)

| Komenda     | Działanie                                  |
| ----------- | ------------------------------------------ |
| `/pomodoro` | Otwiera okno / panel Pomodoro (timer 25/5) |
| `/focus`    | Focus mode — pełny ekran nauki (później)   |
| `/todo`     | Otwiera panel globalnej listy TODO         |
| `/notes`    | Otwiera przeglądarkę notatek               |
| `/files`    | Otwiera system plików (drzewo katalogów)   |
| `/calendar` | Otwiera widok kalendarza                   |

### B — Akcje danych (API, opcjonalnie krótka odpowiedź AI)

| Komenda               | Działanie                                                 |
| --------------------- | --------------------------------------------------------- |
| `/clear short memory` | `DELETE` short-term memory → „Wyczyszczono krótką pamięć” |
| `/clear memory`       | Dialog potwierdzenia → czyści short + long                |
| `/sync librus`        | Trigger sync z wtyczki / przypomnienie o instalacji       |

### C — Seed prompty (wysyłane do AI)

| Komenda         | Seed (skrót)                                                         |
| --------------- | -------------------------------------------------------------------- |
| `/plan`         | „Ułóż plan na dziś z uwzględnieniem wolnego czasu, TODO i terminów…” |
| `/plan tydzień` | Plan tygodnia z rozłożeniem nauki przed sprawdzianami                |
| `/roi`          | 3 tematy o najwyższym ROI na podstawie ocen i terminów               |
| `/quiz [temat]` | 8 pytań zamkniętych + 2 otwarte                                      |
| `/diff`         | Podsumuj zmiany ocen / wiedzy od ostatniego tygodnia                 |
| `/review`       | Wieczorna retrospektywa dnia                                         |

## Implementacja (techniczna)

```
ChatComposer
  → onSubmit(text)
  → parseSlashCommand(text)
      → { type: "ui", command: "pomodoro" }     → openPomodoro()
      → { type: "api", command: "clear-short-memory" } → api.clearShortMemory()
      → { type: "prompt", seed: "...", display: "/plan" } → sendChat(seed)
      → null → normal send
```

Pliki:

- `packages/web/lib/commands.ts` — parser + registry
- `packages/web/lib/command-seeds.ts` — mapowanie seed → tekst PL
- `packages/web/islands/CommandPalette.tsx` — autocomplete (opcjonalnie Cmd+K)

## Powiadomienia a komendy

Kliknięcie powiadomienia „Plan na dziś” ≠ komenda, ale otwiera **nowy czat** z pre-wypełnioną
wiadomością asystenta (jakby agent napisał pierwszy). Użytkownik odpowiada normalnie („dziś mam
lekarza”).

## Priorytet implementacji

1. Parser + `/plan`, `/clear short memory`
2. `/pomodoro` (prosty timer)
3. `/todo`, `/notes`, `/files` (otwarcie paneli)
4. Autocomplete
5. Reszta seed promptów

## Definition of Done

- [x] Parser slash commands w composerze
- [x] Min. 3 komendy UI + 3 seed + 1 akcja API
- [x] Autocomplete przy `/`
- [ ] Dokumentacja komend w UI (help `/?` lub panel)
