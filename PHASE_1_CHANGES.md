# Phase 1 — Safety net (applied)

This phase hardens the app for real-world / single-user-per-account usage.
**No third-party credentials needed yet** — that comes in Phase 2.

## What changed

### Database schema (`lib/db/src/schema/*`)
- Added `user_id text NOT NULL` to: `files`, `cloud_accounts`, `naming_rules`,
  `rename_history`, `org_score_snapshots`.
- Added per-user indexes (`(user_id)`, `(user_id, status)`, `(user_id, category)`,
  `(user_id, cloud_account_id)`, `(user_id, updated_at)`, `(user_id, performed_at)`).
- `org_score_snapshots` unique constraint changed from `date` → `(user_id, date)`.
- **New table `oauth_states`** — persisted, single-use, 10-min-TTL CSRF tokens
  for the OAuth connect flow.

### API server (`artifacts/api-server/src/*`)
- **Auth enforced** — new `requireAuth` middleware rejects any request without
  a Clerk session (`401`). `/api/healthz` is the only unauthenticated route.
- **Per-user scoping** — every query in `files`, `rules`, `cloud-accounts`,
  `history`, `stats`, `oauth` is now filtered by the Clerk `userId`. Cross-user
  data leakage is no longer possible.
- **CORS allowlist** — set `ALLOWED_ORIGINS` env var (comma-separated). Dev
  falls back to localhost + `*.replit.dev` / `*.replit.app`.
- **`helmet`** security headers added.
- **`express-rate-limit`** — 240 req/min per IP on the API surface.
- **Body size limit** — 256 KB on JSON/urlencoded.
- **OAuth state persistence** — random 24-byte hex state stored server-side,
  verified against (user, provider) on callback, then consumed (single-use).
- **Client can no longer set `connectedViaOAuth: true`** via plain
  `POST /cloud-accounts` — only `/oauth/callback/:provider` does that.
- **Bulk-rename** — fixed N+1 sequential query loop (now one `inArray` fetch);
  generated script includes `mkdir -p` and `set -euo pipefail`; hard cap of
  500 files per request.
- **Scan** — hard cap of 1000 filenames per request.
- **History limit** — capped at 500 per request.
- **`/files` list** ordering changed to `desc(createdAt)` (newest first).

### Naming logic (`artifacts/api-server/src/lib/naming.ts`)
- Removed the noisy "any 4-digit year → 2024-01-01" fallback. A standalone
  year with no month/quarter signal is now treated as "no date detected".
- `sanitizeDescription` no longer collapses empties to the shared string
  "untitled" — it now produces a stable per-input slug (`file-<hash>`), so
  unrelated files with non-ASCII names no longer get bucketed as duplicates.

### Frontend
- Dashboard's `recordSnapshot.mutate()` now fires at most once per browser
  session per day (was firing on every dashboard mount).

---

## How to apply on Replit

```bash
# 1. Install new dependencies
pnpm install

# 2. Wipe existing dev rows (you confirmed this is fine) + push new schema
#    drizzle-kit push will detect the not-null user_id column on populated
#    tables and prompt you. Easiest path:
psql "$DATABASE_URL" -c "
  TRUNCATE files, cloud_accounts, naming_rules, rename_history,
  org_score_snapshots RESTART IDENTITY CASCADE;
"
pnpm --filter @workspace/db run push

# 3. Regenerate the API client/zod schemas (no spec changes were needed, but
#    safe to re-run):
pnpm --filter @workspace/api-spec run codegen

# 4. Run the API server
pnpm --filter @workspace/api-server run dev
```

## New / required env vars

| Var | Where | Required? | Example |
|-----|-------|-----------|---------|
| `ALLOWED_ORIGINS` | api-server | Production | `https://fileorbit.app,https://app.fileorbit.app` |
| `DATABASE_URL` | already used | yes | `postgres://...` |
| `CLERK_PUBLISHABLE_KEY` | already used | yes | `pk_test_...` |
| `CLERK_SECRET_KEY` | already used | yes (prod) | `sk_test_...` |
| `VITE_CLERK_PUBLISHABLE_KEY` | file-manager | yes | `pk_test_...` |

## Quick smoke tests after deploy

1. Unauthenticated `curl https://your-host/api/files` → **401**
2. Unauthenticated `curl https://your-host/api/healthz` → **200** `{"status":"ok"}` (or similar)
3. With Clerk session: create a file as user A, sign in as user B → user B sees **none of A's files**
4. Hit `/api/files` 250×/min from one IP → request **#241** returns **429**
5. Connect cloud account → `oauth_states` table receives a row, then the row
   disappears after `/oauth/callback/:provider` completes.

## Files touched

```
lib/db/src/schema/files.ts                              (rewritten)
lib/db/src/schema/cloud-accounts.ts                     (rewritten)
lib/db/src/schema/naming-rules.ts                       (rewritten)
lib/db/src/schema/rename-history.ts                     (rewritten)
lib/db/src/schema/org-score-snapshots.ts                (rewritten)
lib/db/src/schema/oauth-states.ts                       (new)
lib/db/src/schema/index.ts                              (export added)
artifacts/api-server/package.json                       (+helmet, +express-rate-limit)
artifacts/api-server/src/app.ts                         (rewritten — helmet, cors allowlist, requireAuth wiring, rate-limit)
artifacts/api-server/src/middlewares/requireAuth.ts     (new)
artifacts/api-server/src/routes/index.ts                (health split out)
artifacts/api-server/src/routes/files.ts                (rewritten — scoped, bulk-rename fixes)
artifacts/api-server/src/routes/rules.ts                (rewritten — scoped)
artifacts/api-server/src/routes/cloud-accounts.ts       (rewritten — scoped)
artifacts/api-server/src/routes/history.ts              (rewritten — scoped, limit cap)
artifacts/api-server/src/routes/stats.ts                (rewritten — scoped)
artifacts/api-server/src/routes/oauth.ts                (rewritten — persisted CSRF state)
artifacts/api-server/src/lib/naming.ts                  (rewritten — date+description fixes)
artifacts/file-manager/src/pages/dashboard.tsx          (snapshot mutate guarded)
```

---

# Next: Phase 2 — Real cloud integrations

When you're ready, I'll need:

### Google Drive
- Google Cloud Console → **OAuth 2.0 Client ID (Web application)**
- Scopes: `https://www.googleapis.com/auth/drive.metadata.readonly` + `drive.file`
- Authorized redirect URI: `https://<your-host>/api/oauth/callback/google_drive`
- Env vars I'll wire: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Dropbox
- Dropbox App Console → **App key + secret** (Scoped App, "Full Dropbox" access)
- Redirect URI: `https://<your-host>/api/oauth/callback/dropbox`
- Env vars: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`

### OneDrive
- Microsoft Entra (Azure portal) → **App registration**
- API permissions: `Files.ReadWrite`, `User.Read`, `offline_access`
- Redirect URI: `https://<your-host>/api/oauth/callback/onedrive`
- Env vars: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (use `common` for personal accounts)

When you've created any/all of those and want to start Phase 2, paste me the
client IDs (the secrets you can leave in env vars on your host — I'll wire
the code to expect them by name).
