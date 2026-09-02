# Prompty i packing kontekstu

## Zasada główna (NOWA)

**Agent NIE dostaje pełnego kontekstu ucznia na start.**

Zamiast wielkiego `ContextPacket` w system prompcie:
- Krótki system prompt z **instrukcją użycia tools**
- Agent **sam pobiera** dane gdy potrzebuje: oceny, TODO, kalendarz, pamięć, pliki

Powód: mniej tokenów, mniej halucynacji, świeższe dane, skalowalność.

## System prompt (Faza 0 — aktualny, do zmiany)

Zaimplementowany w `packages/api/ai/system-prompt.ts`:

- Tożsamość: ChatGPA, Cursor-do-szkoły.
- Język: polski.
- Pamięć: **wciąż wstrzykiwana** jako `buildMemoryBlock()` — **do usunięcia** w Fazie 2H.

## Docelowy system prompt (lazy context)

```
Jesteś ChatGPA — osobisty asystent edukacyjny (jak Cursor, ale do szkoły).

Zasady:
- Odpowiadaj po polsku, krótko i konkretnie.
- NIE zgaduj ocen, terminów ani planu lekcji. Użyj narzędzi:
  - memory.list — fakty o uczniu
  - todo.list — zadania
  - calendar.list / calendar.freeSlots — terminy i wolny czas
  - fs.read — notatki, plany, snapshot Librus (~/school/librus/grades.json)
  - grades.summary — średnie i oceny per przedmiot (gdy dostępne)
- Przed planowaniem dnia: zawsze calendar.freeSlots + todo.list.
- Nie wymyślaj — jeśli tool zwróci pusty wynik, powiedz wprost i zaproponuj sync Librus.
- Ton: wspierający korepetytor.

Masz dostęp do wirtualnego systemu plików ~ (notatki, todo, kalendarz, książki).
```

## ContextPacket → deprecated

Stary model (XML w prompcie) zastępujemy **on-demand tools**:

| Stare (w prompcie) | Nowe (tool) |
| ------------------ | ----------- |
| `<profil>` | `fs.read("~/profile/me.profile")` |
| `<todo_otwarte>` | `todo.list({ status: "open" })` |
| `<najblizsze_terminy>` | `calendar.list({ from, to })` |
| `<przedmioty>` / oceny | `fs.read("~/school/librus/grades.json")` lub `grades.summary` |
| Pamięć | `memory.list({ kind })` |
| Plan lekcji | `fs.read("~/school/librus/schedule.json")` |

### Wyjątki (mały stały kontekst OK)

- Dzisiejsza data (`datetime.now` lub jedna linia w prompcie)
- Tryb agenta (`ask` | `plan` | `agent`) jeśli wprowadzimy tryby
- **Nie** wklejaj listy ocen, całego TODO ani pamięci

## Zasady packingu (zaktualizowane)

1. **Lazy first** — dane tylko przez tools w momencie potrzeby.
2. **Budget tokenów** — dotyczy wyników tools (truncate długich plików, np. 8k znaków).
3. **Świeżość** — przy ocenach sprawdź `syncedAt` w snapshot; jeśli >24h, ostrzeż użytkownika.
4. **Prawda** — tylko dane z tools/DB.
5. **Background jobs** (plan dnia, powiadomienia) — osobny wąski prompt z **pre-zebranymi** danymi z DB, nie pełna historia czatu.

## Akcje strukturalne

Model zwraca bloki `chatgpa-action` (obecny mechanizm):

````
```chatgpa-action
{ "type": "todo.add", "title": "Powtórka: kwasy", "estimatedMinutes": 25 }
```
````

Rozszerzyć o: `memory.remember`, `fs.write`, `calendar.add`, `notes.write`, itd.

## Szablony użytkownika (slash)

Patrz [komendy.md](./komendy.md) — `/plan`, `/quiz`, `/clear short memory`, itd.

## Ewaluacja jakości

1. „Jaka mam średnia z chemii?” bez sync → agent woła tool, nie zmyśla.
2. „Ułóż plan na dziś” → agent woła `calendar.freeSlots` + `todo.list` przed odpowiedzią.
3. Pytanie ogólne (np. „co to jest mitoza”) → **nie** woła tools niepotrzebnie.
4. Ton PL, fallback modeli nadal użyteczny.
