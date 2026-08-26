# Architektura

## Stack

| Warstwa      | Tech                                    |
| ------------ | --------------------------------------- |
| Runtime      | Deno 2.9+                               |
| API          | Hono (`packages/api`)                   |
| Web          | Fresh 2 + Preact (`packages/web`)       |
| Shared       | `@chatgpa/core` (typy)                  |
| DB (później) | PostgreSQL + pgvector + Drizzle         |
| AI           | Multi-provider cascade (darmowe klucze) |

## Monorepo

```
chatgpa/
├── ai-kontekst/          # Ten folder — kontekst dla AI i ludzi
├── packages/
│   ├── core/             # Typy współdzielone
│   ├── api/              # Hono REST + AI cascade
│   │   └── ai/           # Dostawcy, ranking modeli, fallback
│   └── web/              # Fresh PWA — UI chatu
├── deno.json             # Workspace root
└── .env                  # Klucze API (nigdy w git)
```

## Przepływ chatu (Faza 0)

```
Browser (Fresh island)
  POST /api/chat { messages: [...] }
        │
        ▼
Hono API  →  cascade.tryAll(messages)
        │
        ├─ model #1 (najmądrzejszy dostępny)  ──fail──┐
        ├─ model #2                                 │
        ├─ …                                        │
        └─ model #N (najgłupszy / lokalny fallback) ◀┘
        │
        ▼
{ content, model, provider, attempts[] }
```

## CORS / porty

- API: `http://localhost:8000`
- Web: `http://localhost:5173`
- Web woła API bezpośrednio; API ma CORS dla origin web.

## Konfiguracja AI

Klucze w `.env` (patrz `.env.example`). Brak klucza = pomijamy dostawcę. Jeśli **żaden** klucz nie
jest ustawiony, API zwraca czytelny błąd z linkami do darmowych rejestracji.

## Bezpieczeństwo kluczy

- Tylko serwer zna klucze — nigdy nie lecą do przeglądarki.
- `.env` w `.gitignore`.
- Rate-limit po stronie naszej (później), żeby nie spalić darmowych limitów.
