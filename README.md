
Action: file_editor create /app/README.md --file-text "# FileOrbit — Smart File Manager

> Stop losing files. Start organizing them.

FileOrbit enforces a consistent naming convention across all your cloud
storage accounts, detects duplicates, and puts every file in the right
folder — automatically.

---

## What it does

Every file gets renamed to a single, predictable pattern:

```
{YYYY-MM-DD}_{Category}_{SubCategory}_{Description}_{version}.{ext}
```

**Example:** `contract draft (2).pdf` → `2024-03-15_Work_Contracts_client-agreement_v3.pdf`

The app then places it in the correct folder tree (`Documents/Work/Contracts/`)
and tracks it across whichever cloud you have connected (Google Drive,
Dropbox, OneDrive, iCloud, Box).

### Features

- **Instant naming suggestions** — drag any file into the Drop Zone to get
  a perfectly structured name with category detection and confidence score.
- **Bulk scan** — paste a list of filenames (or import a CSV) and get
  rename suggestions for every one in a single pass.
- **Duplicate detection** — surfaces files that look like copies across
  every connected account, with an estimate of how much space you'd reclaim.
- **Multi-cloud tracking** — one view across Google Drive, Dropbox,
  OneDrive, iCloud, and Box.
- **Bulk rename** — apply suggested names to hundreds of files at once, or
  download a shell script to run yourself.
- **Custom rules** — override the default naming pattern per category
  (e.g. tax docs get a different template than photos).
- **Organization Score** — a single 0–100% number that tells you how tidy
  your digital life is, tracked daily with a 30-day trend.
- **Undo history** — every rename is logged and reversible.

---

## Pages

| Route | Purpose |
|---|---|
| `/` | Dashboard — stats, charts, org score, recent activity |
| `/files` | Searchable, filterable list of every tracked file |
| `/duplicates` | Grouped view of suspected duplicates with bulk resolve |
| `/history` | Rename & organize history with one-click undo |
| `/scan` | Bulk-paste filenames for organization suggestions |
| `/drop` | Drag-and-drop zone for instant single-file analysis |
| `/rules` | Manage custom naming rules per category |
| `/accounts` | Connect and manage cloud storage accounts |
| `/convention` | Reference guide for the naming convention |

---

## Stack

| Layer | Choice |
|---|---|
| Package manager | **pnpm** workspaces (monorepo) |
| Language | **TypeScript 5.9**, strict mode |
| Backend | **Express 5** + **Pino** logging |
| Database | **PostgreSQL** + **Drizzle ORM** |
| Auth | **Clerk** (single-user-per-account) |
| Validation | **Zod v4** + `drizzle-zod` |
| API spec | **OpenAPI 3.1** (source of truth) |
| API codegen | **Orval** → TanStack Query hooks + Zod schemas |
| Frontend | **React 18** + **Vite** + **Wouter** router |
| Styling | **Tailwind CSS** + **shadcn/ui** + Radix primitives |
| Charts | **Recharts** |
| Build | **esbuild** (server), **Vite** (client) |

---

## Repository layout

```
/
├── artifacts/
│   ├── api-server/         # Express API (@workspace/api-server)
│   │   ├── src/
│   │   │   ├── app.ts               # helmet, CORS, Clerk, rate-limit
│   │   │   ├── middlewares/
│   │   │   │   ├── clerkProxyMiddleware.ts
│   │   │   │   └── requireAuth.ts   # Clerk session → req.userId
│   │   │   ├── routes/              # files, rules, cloud-accounts,
│   │   │   │                        # stats, oauth, history, health
│   │   │   └── lib/naming.ts        # date/category/version logic
│   │   └── package.json
│   ├── file-manager/       # React SPA (@workspace/file-manager)
│   │   ├── src/
│   │   │   ├── App.tsx              # Clerk + Wouter routing
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── lib/queryClient.ts
│   │   └── package.json
│   └── mockup-sandbox/     # (design experiments)
│
├── lib/
│   ├── db/                 # Drizzle schema (@workspace/db)
│   │   └── src/schema/
│   │       ├── files.ts
│   │       ├── cloud-accounts.ts
│   │       ├── naming-rules.ts
│   │       ├── rename-history.ts
│   │       ├── org-score-snapshots.ts
│   │       └── oauth-states.ts       # CSRF-safe OAuth state store
│   ├── api-spec/           # openapi.yaml + Orval config
│   ├── api-zod/            # Generated Zod schemas
│   └── api-client-react/   # Generated TanStack Query hooks
│
├── scripts/                # Workspace helper scripts
├── PHASE_1_CHANGES.md      # Latest hardening changelog
└── memory/PRD.md           # Upgrade roadmap
```

---

## Getting started

### Prerequisites
- **Node.js 24**
- **pnpm 9+** (do not use npm/yarn — the root `preinstall` script enforces this)
- **PostgreSQL** (any 14+ instance; Neon/Supabase/local all fine)
- **Clerk** account (free tier is fine) — [https://dashboard.clerk.com](https://dashboard.clerk.com)

### 1. Install
```bash
pnpm install
```

### 2. Configure environment

Create `.env` at the repo root (or use your host's env-var UI):

```bash
# Database
DATABASE_URL=postgres://user:pass@host:5432/fileorbit

# Clerk (from https://dashboard.clerk.com → API Keys)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Frontend needs the publishable key too
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# CORS — comma-separated list of allowed origins in production
# In dev, localhost + *.replit.dev / *.replit.app are auto-allowed
ALLOWED_ORIGINS=https://your-domain.com
```

### 3. Push the database schema
```bash
pnpm --filter @workspace/db run push
```

### 4. Generate the API client (only if you've edited `openapi.yaml`)
```bash
pnpm --filter @workspace/api-spec run codegen
```

### 5. Run the API server
```bash
pnpm --filter @workspace/api-server run dev
```
The server listens on the port your host provides (Replit sets it
automatically; local dev defaults to `8080`).

### 6. Run the frontend
```bash
pnpm --filter @workspace/file-manager run dev
```
Vite serves on `http://localhost:5173` by default.

---

## Common commands

| Command | What it does |
|---|---|
| `pnpm run typecheck` | Full-workspace TypeScript typecheck |
| `pnpm run build` | Typecheck + build every package |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks & Zod schemas from OpenAPI |
| `pnpm --filter @workspace/db run push` | Push schema changes to the DB (dev) |
| `pnpm --filter @workspace/api-server run dev` | Run the API server locally |
| `pnpm --filter @workspace/file-manager run dev` | Run the SPA locally |

---

## API overview

All routes are prefixed with `/api` and (except `/api/healthz`) require a
valid Clerk session. Every query is automatically scoped to the caller's
`userId` — you can only see your own files.

| Endpoint | Purpose |
|---|---|
| `GET /api/healthz` | Public health check |
| `GET/POST /api/files` | List / create files |
| `GET/PATCH/DELETE /api/files/:id` | Read / update / delete |
| `POST /api/files/suggest-name` | Get a name suggestion for a single file |
| `POST /api/files/scan` | Bulk analyze a list of filenames (up to 1000) |
| `GET /api/files/duplicates` | Grouped duplicate detection |
| `POST /api/files/bulk-rename` | Apply names to many files (up to 500) or download a shell script |
| `GET/POST /api/rules` · `PATCH/DELETE /api/rules/:id` | Per-user naming rules |
| `GET/POST /api/cloud-accounts` · `PATCH/DELETE /api/cloud-accounts/:id` | Connected cloud storage |
| `GET /api/cloud-accounts/recommend-placement?fileSizeGb=...` | Which account has room? |
| `GET /api/oauth/connect/:provider` | Start OAuth flow (returns state) |
| `POST /api/oauth/callback/:provider` | Finish OAuth flow (verifies state) |
| `GET/POST /api/history` · `POST /api/history/:id/undo` | Rename history + undo |
| `GET /api/stats/dashboard` | Summary counters + file-type breakdown |
| `GET /api/stats/category-breakdown` | Files grouped by category |
| `GET /api/stats/recent-activity` | Latest updated files |
| `GET /api/stats/org-trend` · `POST /api/stats/org-trend/record` | 30-day organization-score trend |

The full spec — including every request/response schema — lives in
[`lib/api-spec/openapi.yaml`](./lib/api-spec/openapi.yaml).

---

## Security

- **Auth** — Clerk session required on every business route. `/api/healthz`
  is the only public endpoint.
- **Tenancy** — every table has a `user_id` column and every query is
  scoped to `req.userId`. Cross-user data leakage is prevented at the
  query layer, not at the app layer.
- **CORS** — strict allowlist via `ALLOWED_ORIGINS` env var; no
  wildcard-with-credentials.
- **Rate limit** — 240 req/min per IP on the API surface (`express-rate-limit`).
- **Body size** — 256 KB cap on JSON/form-urlencoded bodies.
- **Bulk endpoints** — hard caps of 500 files (rename) and 1000 filenames (scan).
- **Security headers** — `helmet` defaults.
- **OAuth CSRF** — state tokens are random 24-byte hex, persisted
  server-side with a 10-minute TTL, verified against the connecting
  user + provider on callback, and consumed single-use.
- **`connectedViaOAuth`** — cannot be set by clients; only the
  `/oauth/callback/:provider` route can mark an account as OAuth-connected.

---

## Naming convention rules

The order of parts in the generated filename is fixed:

```
{YYYY-MM-DD} _ {Category} _ [{SubCategory} _] {Description} _ {version}.{ext}
```

- **Date** — extracted from the filename if a full date, `YYYY-MM`, month name + year, or quarter (`Q1 2024`) is present; otherwise today's date. A bare `20xx` year with no other signal is **not** used (too noisy).
- **Category** — one of `Work`, `Finance`, `Personal`, `Projects`, `Media`, `Archives`. Inferred from keywords + extension.
- **SubCategory** — optional, category-specific (e.g. `Work/Reports`, `Finance/Tax`).
- **Description** — sanitized kebab-case slug of the original name, max 50 chars.
- **Version** — `v1`, `v2`, ... incremented when a matching description already exists.

Folder placement:

| Category | Folder |
|---|---|
| Work | `Documents/Work/{SubCategory}/` |
| Finance | `Documents/Finance/{SubCategory}/` |
| Personal | `Documents/Personal/{SubCategory}/` |
| Projects | `Documents/Projects/{Client}/` |
| Media | `Media/{SubCategory}/` |
| Archives | `Archives/{Year}/` |

Users can override any of this via **Naming Rules** (`/rules`).

---

## Development notes

- **Hot reload** on both the API server (`esbuild --watch`) and the SPA (Vite HMR).
- The API and SPA share types end-to-end via `openapi.yaml` → Orval → typed hooks.
- Do **not** edit files in `lib/api-client-react/src/` or `lib/api-zod/src/` — they're generated. Edit `lib/api-spec/openapi.yaml` and re-run codegen.
- The `mockup-sandbox` package is a scratchpad for design experiments and is not deployed.

---

## Deployment

The stack is host-agnostic — anywhere that runs Node 24 + Postgres works:

- **Replit** (current dev host) — deploy the api-server as a Reserved VM
  deployment; serve the built frontend as a static site.
- **Fly.io / Railway / Render / Vercel + Neon** — provision Postgres, set
  the env vars above, run `pnpm build`, then `node artifacts/api-server/dist/index.mjs`.

A dedicated `DEPLOYMENT.md` will be added once we finalize the target host.

---

## Roadmap

Tracked in [`memory/PRD.md`](./memory/PRD.md).

- ✅ **Phase 1 — Safety net** (per-user tenancy, auth enforcement, CORS, rate limiting, CSRF-safe OAuth)
- 🚧 **Phase 2 — Real cloud sync** (Google Drive / Dropbox / OneDrive OAuth + file ops)
- ⏭ **Phase 3 — UX overhaul** (landing redesign, ⌘K palette, inline rename + undo, mobile polish)
- ⏭ **Phase 4 — Perf + DX** (SQL-side dedupe, pagination, GIN trigram, Drizzle migrations, Vitest + CI)

Deferred: AI-powered category detection, OCR for PDFs/images, browser extension, saved smart views, team/org tenancy.

---

## License

MIT.
"
Observation: Create successful: /app/README.md
