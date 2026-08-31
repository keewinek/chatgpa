# ChatGPA

ChatGPA is an autonomous educational system — a **"Cursor for School"**. Chat with free AI, plan
your day, track learning, and (soon) pull context from Librus.

## Stack

- **Runtime:** [Deno](https://deno.com/) 2.9+ (TypeScript-first)
- **App:** [Fresh 2](https://fresh.deno.dev/) UI + [Hono](https://hono.dev/) API (one deploy)
- **Database:** PostgreSQL + pgvector (planned)
- **ORM:** Drizzle ORM (planned)

## AI kontekst

Product context for agents and humans: [`ai-kontekst/`](./ai-kontekst/).

## Monorepo layout

```
ai-kontekst/   # Product / AI context (Markdown)
packages/
├── core/      # Shared chat types (@chatgpa/core)
├── api/       # Hono REST + AI cascade (@chatgpa/api)
└── web/       # Fresh app — UI + mounted API (@chatgpa/web)
```

One URL in production:

```
https://your-app.deno.dev/
  /              → chat UI
  /api/chat      → AI cascade
  /api/health    → health check
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

# Run UI + API together (http://localhost:5173)
deno task dev

# Build and run production server locally
deno task build
deno task start

# Optional: API-only dev server (http://localhost:8000)
deno task dev:api

# Format, lint, type-check, and test
deno task fmt
deno task lint
deno task check
deno task test
```

## Deno Deploy

Create **one** project from this repo:

| Setting       | Value                                         |
| ------------- | --------------------------------------------- |
| App Directory | `./packages/web/`                             |
| Build command | `deno task build`                             |
| Entry / start | `deno task start` (serves `_fresh/server.js`) |

Add AI keys in **Settings → Environment Variables** (`GEMINI_API_KEY`, `GROQ_API_KEY`, or
`OPENROUTER_API_KEY`).

## API endpoints

| Method | Path             | Description                                   |
| ------ | ---------------- | --------------------------------------------- |
| GET    | `/api/health`    | Health check                                  |
| GET    | `/api/ai/models` | Free model cascade + key status               |
| POST   | `/api/chat`      | Chat with memory, tools, and markdown replies |

Chat requests accept `{ messages, memory?: string[] }` and return updated `memory` plus
`toolResults`.

## Environment variables

Copy `.env.example` to `.env` and fill in **at least one** free AI key.

| Variable             | Description                  |
| -------------------- | ---------------------------- |
| `GEMINI_API_KEY`     | Google AI Studio (free)      |
| `GROQ_API_KEY`       | Groq (free)                  |
| `OPENROUTER_API_KEY` | OpenRouter `:free` models    |
| `PORT`               | Only for `deno task dev:api` |
| Web dev port         | `5173` (Fresh/Vite)          |
