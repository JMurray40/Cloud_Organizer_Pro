# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (artifacts/file-manager)

## Application: FileOrbit — Smart File Manager

A full-stack document organization system that:
- Enforces a naming convention: `{YYYY-MM-DD}_{Category}_{SubCategory}_{Description}_{version}.{ext}`
- Tracks files across multiple cloud storage accounts (Google Drive, Dropbox, OneDrive, iCloud, Box)
- Detects potential duplicate files
- Provides a drag-and-drop zone for instant naming suggestions
- Allows bulk scanning of filename lists for organization recommendations
- Maintains customizable naming rules per category

### Categories & Folder Structure
- **Work** → `Documents/Work/{SubCategory}/` (Reports, Contracts, Proposals, Presentations, Invoices, Correspondence)
- **Finance** → `Documents/Finance/{SubCategory}/` (Receipts, Tax, Banking, Insurance, Investments)
- **Personal** → `Documents/Personal/{SubCategory}/` (Photos, Health, Legal, Education, Travel)
- **Projects** → `Documents/Projects/{ClientOrProject}/`
- **Media** → `Media/{SubCategory}/` (Photos, Videos, Audio)
- **Archives** → `Archives/{Year}/`

### Pages
- `/` — Dashboard with stats, category chart, and recent activity
- `/files` — Searchable, filterable list of all tracked files
- `/scan` — Bulk scan: paste filenames, get instant suggestions
- `/drop` — Drag-and-drop zone for file analysis
- `/rules` — Manage naming rules per category
- `/accounts` — Connect and manage cloud storage accounts
- `/convention` — Reference guide for the naming convention

### Database Tables
- `files` — Tracked file records with original name, suggested name, category, status, etc.
- `naming_rules` — Customizable naming patterns per category
- `cloud_accounts` — Connected cloud storage services

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
