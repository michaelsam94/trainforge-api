# Cloudflare Workers — Git build settings

Use these in the Workers **Build** configuration when the repo is connected to GitHub.

| Setting | Value |
|---------|--------|
| **Root directory** | `/` |
| **Build command** | `npm run build` |
| **Deploy command** | `npx wrangler deploy -c wrangler.production.toml` |

Or a single combined command:

```bash
npm run build && npx wrangler deploy -c wrangler.production.toml
```

**Node version:** 20 or 22

**Notes**
- `npm run build` runs TypeScript validation (`tsc --noEmit`). Wrangler bundles the worker on deploy.
- D1 migrations are **not** run automatically — run `npm run db:migrate:remote` manually when schema changes.
- Set secrets in the Cloudflare dashboard or via `wrangler secret put … -c wrangler.production.toml`.

The npm audit warnings in the build log are informational and do not fail the build.
