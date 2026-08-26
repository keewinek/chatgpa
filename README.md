# ChatGPA

ChatGPA is an autonomous educational system — a **"Cursor for School"**. Chat with free AI, plan
your day, track learning, and (soon) pull context from Librus.

## Stack

- **Runtime:** [Deno](https://deno.com/) 2.9+ (TypeScript-first)
- **API:** [Hono](https://hono.dev/) + free multi-provider AI cascade
- **Database:** PostgreSQL + pgvector (planned)
- **ORM:** Drizzle ORM (planned)
- **Client:** [Fresh 2](https://fresh.deno.dev/) PWA (`@chatgpa/web`)

## AI kontekst

Żywa dokumentacja wizji i decyzji: [`ai-kontekst/`](./ai-kontekst/).

## Monorepo layout

```
ai-kontekst/   # Product / AI context (Markdown)
packages/
├── core/      # Shared types (@chatgpa/core)
├── api/       # Hono REST + AI cascade (@chatgpa/api)
└── web/       # Fresh 2 chat UI (@chatgpa/web)
```

## Prerequisites

Install the latest stable Deno:

```sh
curl -fsSL https://deno.land/install.sh | sh
deno upgrade
```

Verify:

```sh
deno --version   # 2.9.5+
```

## Getting started

From the repo root:

```sh
# Copy env and add at least one free AI key
cp .env.example .env

# Install/cache dependencies and generate deno.lock
deno install

# Run the API dev server (http://localhost:8000)
deno task dev:api

# Run the Fresh dev server (http://localhost:5173)
deno task dev:web

# Build and run the web app for production
deno task build:web
deno task start:web

# Format, lint, type-check, and test
deno task fmt
deno task lint
deno task check
deno task test
```

## API endpoints

| Method | Path             | Description                     |
| ------ | ---------------- | ------------------------------- |
| GET    | `/health`        | Health check                    |
| GET    | `/api/subjects`  | Subject list (stub)             |
| GET    | `/api/ai/models` | Free model cascade + key status |
| POST   | `/api/chat`      | Chat (smart → dumb AI fallback) |

## Environment variables

Copy `.env.example` to `.env` and fill in **at least one** free AI key.

| Variable             | Default                 | Description                  |
| -------------------- | ----------------------- | ---------------------------- |
| `PORT`               | `8000`                  | API server port              |
| `GEMINI_API_KEY`     | —                       | Google AI Studio (free)      |
| `GROQ_API_KEY`       | —                       | Groq (free)                  |
| `OPENROUTER_API_KEY` | —                       | OpenRouter `:free` models    |
| `VITE_API_URL`       | `http://localhost:8000` | API URL for the Fresh client |
| Web dev port         | `5173`                  | Fresh/Vite dev server        |
