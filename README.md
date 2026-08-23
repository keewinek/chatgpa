# ChatGPA

ChatGPA is an autonomous, integrated educational management system designed as a "Cursor for
School". The system connects directly to the student's actual school ecosystem (Librus + Samsung
Notes) to optimize daily effort, prioritize high-value tasks, and systematically elevate academic
performance.

## Stack

- **Runtime:** [Deno](https://deno.com/) 2.9+ (TypeScript-first)
- **API:** [Hono](https://hono.dev/)
- **Database:** PostgreSQL + pgvector (planned)
- **ORM:** Drizzle ORM (planned)
- **Client:** [Fresh 2](https://fresh.deno.dev/) PWA (`@chatgpa/web`)

## Monorepo layout

```
packages/
├── core/   # Shared types (@chatgpa/core)
├── api/    # Hono REST API (@chatgpa/api)
└── web/    # Fresh 2 frontend PWA (@chatgpa/web)
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

## API endpoints (stub)

| Method | Path            | Description         |
| ------ | --------------- | ------------------- |
| GET    | `/health`       | Health check        |
| GET    | `/api/subjects` | Subject list (stub) |

## Environment variables

Copy `.env.example` to `.env` and fill in values as integrations are added.

| Variable     | Default | Description     |
| ------------ | ------- | --------------- |
| `PORT`       | `8000`  | API server port              |
| Web dev port | `5173`  | Fresh/Vite dev server (default) |
