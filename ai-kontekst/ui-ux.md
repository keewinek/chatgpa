# UI / UX

## Zasada

**Chat-first.** Pierwszy viewport = rozmowa. Kalendarz, TODO, tracker = panele boczne / trasy
drugorzędne, nie dashboard pełen kartek.

## Faza 0 (jest)

- Header: brand **ChatGPA** + status kaskady modeli.
- Lista wiadomości (user / assistant).
- Badge `provider/model` pod odpowiedzią asystenta.
- Composer: textarea + Wyślij; Enter wyślij, Shift+Enter newline.
- Loading: „Myślę (kaskada darmowych modeli)…”.
- Błędy: treść + lista prób modeli.
- Fonts: Instrument Serif (brand) + DM Sans (UI).
- Tło: ciepły dark z subtelnymi gradientami (nie fiolet-AI-default).

## Docelowy layout

```
┌──────────────────────────────────────────────┐
│ ChatGPA          [Ask▾] [sync Librus]  ···   │
├────────────┬─────────────────────────────────┤
│ TODO       │  wiadomości                     │
│ Kalendarz  │                                 │
│ Przedmioty │  [composer]                     │
└────────────┴─────────────────────────────────┘
```

Na mobile: chat full-bleed; panele jako bottom sheet / osobne trasy.

## Stany

| Stan            | UI                                      |
| --------------- | --------------------------------------- |
| Brak kluczy AI  | status w headerze + komunikat w chacie  |
| API down        | „uruchom deno task dev:api”             |
| Streaming (później) | tokeny na żywo + model znany na koniec / wcześniej jeśli wybrany |
| Offline         | Ollama / cached last reply (później)    |

## Dostępność

- `role="log"` + `aria-live` na liście wiadomości.
- Kontrast tekstu na dark tle.
- Focus ring na input/send.
- Nie polegaj tylko na kolorze w badge modelu.

## PWA

- `manifest.webmanifest` już jest.
- Dalej: service worker, ikony, Web Push (patrz powiadomienia).

## Mikro-interakcje (docelowo 2–3)

1. Lekkie pojawianie się bubble (`rise`).
2. Pulse na „thinking”.
3. (później) subtelne podkreślenie badge modelu po nowej odpowiedzi.

## Anti-wzorce (unikać)

- Dashboard hero ze statystykami zamiast chatu.
- Karty wszędzie.
- Purple glow / generyczny AI look.
- Ukrywanie użytego modelu.
