# Architektura

## Stack

| Warstwa      | Tech                                    | Status   |
| ------------ | --------------------------------------- | -------- |
| Runtime      | Deno 2.9+                               | ✅       |
| API          | Hono (`packages/api`)                   | ✅       |
| Web          | Fresh 2 + Preact (`packages/web`)       | ✅       |
| Shared       | `@chatgpa/core` (typy)                  | ✅       |
| AI           | Multi-provider cascade                  | ✅       |
| DB           | PostgreSQL + pgvector + Drizzle         | planned  |
| PWA          | manifest + (później) service worker     | partial  |
| Ext          | Browser extension (Librus)              | planned  |

## Monorepo

```
chatgpa/
├── ai-kontekst/          # Kontekst dla AI i ludzi
├── packages/
│   ├── core/             # Typy współdzielone (@chatgpa/core)
│   ├── api/              # Hono REST + AI cascade
│   │   └── ai/           # Dostawcy, ranking, fallback
│   └── web/              # Fresh PWA — UI chatu
│       ├── islands/      # Interaktywny chat
│       └── routes/       # Strony
├── deno.json             # Workspace root
└── .env                  # Klucze API (nigdy w git)
```

## Przepływ chatu (Faza 0) — zaimplementowany

```
Browser (Fresh island ChatApp)
  POST /api/chat { messages: [...] }
        │
        ▼
Hono + CORS
        │
        ▼
runCascade(messages)
        │
        ├─ slot #1 (najwyższy priority, ma klucz) ──fail──┐
        ├─ slot #2                                        │
        ├─ …                                              │
        └─ slot #N (najniższy / „zawsze działa”) ◀────────┘
        │
        ▼
{ message, model, provider, attempts[] }
        │
        ▼
UI: treść + badge `provider/model`
```

## Przepływ docelowy (Context Hub)

```
User message
  → zbuduj ContextPacket (profil + Librus snapshot + TODO + kalendarz + pamięć)
  → system prompt + packet + historia
  → cascade
  → (opcjonalnie) parsuj chatgpa-action / tool calls
  → zapisz stan (TODO/calendar/knowledge)
  → odpowiedź + meta modelu
```

## Endpointy API

| Method | Path             | Opis                          | Status |
| ------ | ---------------- | ----------------------------- | ------ |
| GET    | `/health`        | Health                        | ✅     |
| GET    | `/api/subjects`  | Stub przedmiotów              | stub   |
| GET    | `/api/ai/models` | Lista kaskady + configured    | ✅     |
| POST   | `/api/chat`      | Chat + cascade                | ✅     |
| POST   | `/api/librus/sync` | Snapshot z wtyczki          | planned |
| CRUD   | `/api/todos`     | TODO                          | planned |
| CRUD   | `/api/calendar`  | Wydarzenia                    | planned |
| GET/PUT| `/api/profile`   | Profil ucznia                 | planned |

## CORS / porty

- API: `http://localhost:8000`
- Web: `http://localhost:5173`
- Web woła API bezpośrednio; CORS whitelista localhost.

## Env

Klucze w `.env` (ładowane w `packages/api/main.ts`). Brak klucza = pominięty dostawca.
Brak jakiegokolwiek klucza = 503 z instrukcją.

## Skalowanie (nie teraz)

Single-user lokalnie wystarczy. Gdy DB: jeden user_id, bez multi-tenant.
Ollama jako ostatni offline slot w kaskadzie.
