# TrainForge API

Cloudflare Workers backend for TrainForge — Hono, D1, clean architecture.

## Stack

- **Runtime:** Cloudflare Workers
- **HTTP:** Hono
- **Database:** D1 (SQLite)
- **Storage:** R2, KV
- **Validation:** Zod

## Architecture

```
presentation/ → application/ → domain/ ← infrastructure/
```

See [../docs/adr/002-clean-architecture.md](../docs/adr/002-clean-architecture.md).

## Setup

```bash
npm install
cp .env.example .env
npm run db:migrate:local
npm run dev
```

API runs at `http://localhost:2020`. Health check: `GET /health`.

## Auth (Phase 2)

- **Password hashing:** PBKDF2-SHA256 via Web Crypto (100k iterations) — Workers-native, no bcrypt dependency
- **Sessions:** httpOnly `trainforge_session` cookie + readable `trainforge_csrf` for mutation CSRF checks
- **Routes:** `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/onboarding`

Apply migrations before first auth request:

```bash
npm run db:migrate:local
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local Wrangler dev server (port 2020) |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run db:migrate:local` | Apply D1 migrations locally |

## Environment

Secrets are set via `wrangler secret put` — never commit real values. See `.env.example`.

## Deployment

1. Create D1 database: `wrangler d1 create trainforge-db`
2. Update `database_id` in `wrangler.toml`
3. Create KV namespace and R2 bucket; update bindings
4. `npm run db:migrate:remote`
5. `npm run deploy`
