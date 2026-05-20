# FileOrbit — Upgrade Plan (PRD)

## Original problem statement
"Review the web app and suggest upgrades." — full upgrade pass (deps, code quality, UX, perf, security), real cloud integrations later, AI deferred. Single-user-per-account tenancy. Hosted on Replit today; goal is to make it permanent-host-ready.

## Stack
pnpm monorepo · Express 5 + Drizzle ORM (Postgres) · Clerk auth · React 18 + Vite + shadcn/Tailwind · Orval-generated TanStack Query hooks from OpenAPI.

## Roadmap (4 phases)

### Phase 1 — Safety net ✅ APPLIED (Jan 2026)
See `/app/PHASE_1_CHANGES.md` for the full diff + apply instructions.
- Per-user tenancy via `user_id` on all tables + indexes
- `requireAuth` middleware enforcing Clerk session on every business route
- CORS allowlist via `ALLOWED_ORIGINS`
- `helmet` security headers
- `express-rate-limit` (240 req/min/IP)
- OAuth state persisted, single-use, 10-min TTL (CSRF fix)
- Bulk-rename N+1 fix + `mkdir -p` + 500-file cap
- Naming logic: removed noisy year-only date detection, fixed "untitled" duplicate collision
- Dashboard snapshot mutate guarded (was firing on every nav)

### Phase 2 — Real cloud integrations (next)
- Google Drive OAuth + file list/move (real quota)
- Dropbox OAuth + file ops
- OneDrive (MS Entra) OAuth + file ops
- Background sync job
- Requires: `GOOGLE_CLIENT_ID/SECRET`, `DROPBOX_APP_KEY/SECRET`, `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` from user

### Phase 3 — UX overhaul
- Landing page redesign (escape AI-slop aesthetic)
- ⌘K command palette via `cmdk`
- Inline rename + sonner undo toast
- Empty states on Files / Duplicates / History
- Multi-file drop zone + bulk-select with shift-click
- Mobile drawer swipe-to-close

### Phase 4 — Perf + DX
- SQL-side duplicate grouping (push out of JS)
- `/stats/dashboard-full` aggregate endpoint
- Pagination on `/files`
- GIN trigram indexes for `ilike` search
- Drizzle migrations folder (replace `db push`)
- Vitest setup + naming-convention unit tests
- GitHub Actions CI (typecheck + lint + tests)
- ESLint + Prettier config

## Deferred / Backlog
- AI-powered category detection (model TBD)
- OCR for PDFs/images to extract dates
- Browser extension for "rename in place"
- Webhooks/notifications on duplicate detection
- Saved smart views / filters
- Audit-log CSV export
- File preview side panel
- Team/Org tenancy (currently single-user)

## Notes
- App cannot run inside the Emergent container (supervisor wired for FastAPI/Mongo). User runs on Replit.
- All Phase 1 code is host-agnostic — works on Replit, Fly, Railway, Render, Vercel+Neon.
