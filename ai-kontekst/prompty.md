# Prompty i packing kontekstu

## System prompt (Faza 0 — aktualny)

Zaimplementowany w `packages/api/ai/providers.ts` jako `DEFAULT_SYSTEM_PROMPT`:

- Tożsamość: ChatGPA, Cursor-do-szkoły.
- Język: polski.
- Styl: konkret, bez lania wody.
- Guardrail: nie wymyślaj ocen/terminów; mów gdy brak kontekstu.

## Docelowy system prompt (szkic)

```
Jesteś ChatGPA — osobisty asystent edukacyjny (jak Cursor, ale do szkoły).

Zasady:
- Odpowiadaj po polsku, krótko i konkretnie.
- Nie zmyślaj ocen, terminów ani frekwencji. Jeśli nie ma ich w KONTEKŚCIE — powiedz wprost.
- Preferuj działania: TODO, bloki nauki, quizy, plan dnia.
- Gdy użytkownik prosi o plan, podaj checklistę z czasem w minutach.
- Ton: wspierający korepetytor, nie wykładowca.
- Na końcu długiej odpowiedzi możesz dodać 1–3 „następne kroki”.

Tryb: {{mode}}  # ask | plan | agent | focus
```

## ContextPacket

Pakiet doklejany do system / pierwszej wiadomości systemowej:

```xml
<kontekst_ucznia>
  <profil>...</profil>
  <cel_sredniej>...</cel_sredniej>
  <przedmioty>...</przedmioty>
  <najblizsze_terminy>...</najblizsze_terminy>
  <todo_otwarte>...</todo_otwarte>
  <luki_wiedzy>...</luki_wiedzy>
  <budzet_minut_dzis>...</budzet_minut_dzis>
</kontekst_ucznia>
```

### Zasady packingu

1. **Budget tokenów** — najpierw terminy ≤7 dni, TODO open, słabe przedmioty; reszta skrócona.
2. **Świeżość** — `syncedAt` Librus w pakiecie; jeśli >24h, dodaj ostrzeżenie.
3. **Prawda** — tylko dane z DB/snapshotu, zero hallucinated grades.
4. **Prywatność** — nie loguj raw packetów z PII do zewnętrznych serwisów poza AI API.

## Akcje strukturalne (bez native tools)

Model może zwrócić:

````
```chatgpa-action
{ "type": "todo.add", "title": "Powtórka: kwasy", "subjectId": "chem", "estimatedMinutes": 25 }
```
````

API parsuje → wykonuje → w odpowiedzi UI: „Dodano TODO”.

## Szablony użytkownika (slash / przyciski)

| Komenda        | Prompt seed                                              |
| -------------- | -------------------------------------------------------- |
| `/plan`        | „Ułóż plan dnia na dziś w ramach budżetu minut…”         |
| `/roi`         | „Na podstawie ocen i luk wskaż 3 tematy o najwyższym ROI”|
| `/quiz [temat]`| „Zrób 8 pytań zamkniętych + 2 otwarte z tematu…”         |
| `/diff`        | „Podsumuj zmiany ocen i wiedzy od ostatniego tygodnia”   |
| `/focus`       | „Przygotuj sesję Focus 25 min z tematu…”                 |

## Ewaluacja jakości (manual)

Przed większą zmianą promptu sprawdź:

1. Pytanie bez kontekstu ocen → model mówi „nie wiem”, nie zmyśla.
2. Prośba o plan → checklista z minutami.
3. Ton PL, bez angielskiego boilerplate.
4. Fallback słabszego modelu nadal użyteczny (nie psuje UX).
