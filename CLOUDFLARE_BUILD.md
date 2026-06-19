# Cloudflare Workers — Git build settings

Use these in the Workers **Build** configuration when the repo is connected to GitHub.

| Setting | Value |
|---------|--------|
| **Root directory** | `/` |
| **Build command** | `npm run build` (optional but recommended) |
| **Deploy command** | `npx wrangler deploy` |

`wrangler.toml` is the **production** config (real D1 + KV IDs). Local dev uses `wrangler.dev.toml`.

**Node version:** 20 or 22

**Notes**
- D1 migrations are **not** run automatically — run `npm run db:migrate:remote` when schema changes.
- Set secrets in the Cloudflare dashboard or via `wrangler secret put …`.
- npm audit warnings in the build log are informational and do not fail the build.
