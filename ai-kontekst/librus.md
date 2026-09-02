# Librus — integracja

ChatGPA ma „wiedzieć wszystko o szkole”. Librus jest głównym źródłem prawdy dla ocen, terminów i
zadań.

## Status

`done` — wtyczka w `packages/extension`, endpoint `/api/librus/sync`, merge snapshotów + kalendarz.
Statyczny plan 3A nadal w `@chatgpa/core` ([plan-lekcji.md](./plan-lekcji.md)); sync Librus zapisuje
`~/school/librus/schedule.json`.

## Preferowana architektura: wtyczka przeglądarki

```
[ Librus w przeglądarce (zalogowany) ]
            │ content script czyta DOM / XHR
            ▼
[ Extension ] ──POST JSON──▶ [ ChatGPA API /api/librus/sync ]
            │
            ▼
     LibrusSnapshot w storage
            │
            ▼
     ContextPacket → AI
```

### Dlaczego wtyczka

- Sesja Librus zostaje w przeglądarce (hasło nie musi iść do ChatGPA).
- Omija kruche nieoficjalne logowanie / 2FA po stronie serwera.
- Sync na żądanie gdy jesteś zalogowany.

## Kontrakt sync (szkic)

`POST /api/librus/sync`

```json
{
  "syncedAt": "2026-08-26T18:00:00+02:00",
  "grades": [/* Grade[] */],
  "exams": [/* CalendarEvent[] */],
  "homeworks": [/* Task[] */],
  "subjects": [/* Subject[] */]
}
```

Odpowiedź: `{ ok: true, counts: { grades, exams, homeworks } }`.

## Alternatywy

| Ścieżka                 | Plus                  | Minus                        |
| ----------------------- | --------------------- | ---------------------------- |
| Oficjalne API Librus    | stabilne              | zwykle dla szkół, nie ucznia |
| Nieoficjalne lib (Node) | szybki prototyp       | ToS, 2FA, kruche             |
| CSV / ręczny eksport    | proste                | uciążliwe                    |
| Wtyczka (wybór)         | bezpieczniejsza sesja | trzeba zainstalować          |

## Co syncujemy (MVP)

1. Przedmioty
2. Oceny (wartość, waga, kategoria, data)
3. Terminy sprawdzianów / prac
4. Zadania domowe

Opcjonalnie później: frekwencja, ogłoszenia, wiadomości.

## Bezpieczeństwo

- Hasła Librus **nie** w ChatGPA przy ścieżce wtyczki.
- Snapshot tylko lokalnie.
- Extension origin whitelist → tylko `localhost` / Twój host.
- Nie commituj raw dumpów Librus do gita.

## UX sync

- Przycisk „Sync Librus” w UI + timestamp ostatniego syncu.
- Jeśli sync > 24h → ostrzeżenie w ContextPacket i w statusie.
- Po sync: opcjonalnie automatyczne `plan.today` / ROI refresh.

## Osobne repo?

OK trzymać extension w `packages/extension` albo osobnym repo `chatgpa-librus-ext`. Decyzja: gdy
zaczynamy implementację — wpis w [decyzje.md](./decyzje.md).
