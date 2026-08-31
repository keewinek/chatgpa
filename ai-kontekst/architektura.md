# Architektura

## Stack

| Warstwa | Tech                                | Status  |
| ------- | ----------------------------------- | ------- |
| Runtime | Deno 2.9+                           | ✅      |
| API     | Hono (`packages/api`)               | ✅      |
| Web     | Fresh 2 + Preact (`packages/web`)   | ✅      |
| Shared  | `@chatgpa/core` (chat types)        | ✅      |
| AI      | Multi-provider cascade              | ✅      |
| DB      | PostgreSQL + pgvector + Drizzle     | planned |
| PWA     | manifest + (później) service worker | partial |
| Ext     | Browser extension (Librus)          | planned |

## Monorepo

```
chatgpa/
├── ai-kontekst/          # Kontekst dla AI i ludzi
├── packages/
│   ├── core/             # ChatMessage, ChatRole
│   ├── api/              # Hono REST + AI cascade
│   │   └── ai/           # Dostawcy, ranking, fallback
│   └── web/              # Fresh — UI + mounted API
│       ├── islands/      # Interaktywny chat
│       └── routes/       # Strony
├── deno.json             # Workspace root
└── .env                  # Klucze API (nigdy w git)
```

## Przepływ chatu (Faza 0)

```
Browser (Fresh island ChatApp)
  POST /api/chat { messages: [...] }   # same origin, no CORS
        │
        ▼
Hono (mounted in Fresh at /api/*)
        │
        ▼
runCascade(messages)
        │
        ├─ slot #1 (najwyższy priority, ma klucz) ──fail──┐
        ├─ slot #2                                        │
        ├─ …                                              │
        └─ slot #N (najniższy) ◀──────────────────────────┘
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

| Method  | Path               | Opis                       | Status  |
| ------- | ------------------ | -------------------------- | ------- |
| GET     | `/api/health`      | Health                     | ✅      |
| GET     | `/api/ai/models`   | Lista kaskady + configured | ✅      |
| POST    | `/api/chat`        | Chat + cascade             | ✅      |
| POST    | `/api/librus/sync` | Snapshot z wtyczki         | planned |
| CRUD    | `/api/todos`       | TODO                       | planned |
| CRUD    | `/api/calendar`    | Wydarzenia                 | planned |
| GET/PUT | `/api/profile`     | Profil ucznia              | planned |

## Dev / deploy

- **Dev:** `deno task dev` → Fresh/Vite on `http://localhost:5173` (UI + API same origin)
- **API-only:** `deno task dev:api` → `http://localhost:8000`
- **Prod:** Deno Deploy, `packages/web`, `deno task build` + `deno task start`

## Env

Klucze w `.env` (repo root, ładowane przez `loadEnv()`). Brak klucza = pominięty dostawca. Brak
jakiegokolwiek klucza = 503 z instrukcją.

## Skalowanie (nie teraz)

Single-user lokalnie wystarczy. Gdy DB: jeden user_id, bez multi-tenant. Ollama jako ostatni offline
slot w kaskadzie.
