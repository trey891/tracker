# Pulse — Construction Project Tracker

A real, database-backed replacement for the **Parcel C project tracker** Excel
workbook (`The Crescent Offices on 7th` / GPIF CD II). It reproduces the "Pulse
Status Hub" dashboard you prototyped and makes it **persist real data** with
team logins.

Built with **Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL ·
Auth.js (NextAuth v5) · Tailwind**. Designed to deploy to Vercel with any hosted
Postgres (Supabase / Neon / RDS), and multi-project from day one.

---

## What's inside

| Page | Replaces (workbook) | Features |
|------|---------------------|----------|
| **Dashboard** | `Parcel_C` weekly report | KPI cards, weekly status-trend chart, top issues, hard-cost projections, budget utilization, owner-allowance donut, change orders/PCOs, recent activity |
| **Tasks** | `Parcel_C` Top Issues + Tasks | Full **create / edit / delete**, filter by status & workstream, search, top-issue flag, leads, deadlines, blockers |
| **Hard Cost** | `Parcel_C` financials + `Committments` | Budget→forecast waterfall, contingency, soft costs, funding sources, vendor commitments register, milestone schedule with variance |
| **PCO Log** | `PCO Log & Dashboard` | Status buckets, reason analysis, funding-source breakdown, Exhibit F owner-allowance usage tracker |
| **Team** | `Parcel_C` TEAM header | Members, per-person workload (assigned / open / blocked) |
| **Analytics** | demo Analytics view | Status-over-time, health score, status-by-workstream, priority distribution |

All figures are **seeded verbatim** from the workbook (`scripts/extract_xlsx.py`
→ `prisma/seed-data.json`), so the app is fully populated on first run.

---

## Quick start (local)

Prerequisites: Node 18+, and Postgres (Docker is easiest).

```bash
# 1. Install deps
npm install

# 2. Start a local Postgres (or point DATABASE_URL at any Postgres)
docker compose up -d

# 3. Configure environment
cp .env.example .env
#   - set AUTH_SECRET:  openssl rand -base64 32
#   - (optional) change SEED_PASSWORD before seeding

# 4. Create the schema and load the workbook data
npm run db:push
npm run db:seed

# 5. Run it
npm run dev        # http://localhost:3000
```

Sign in with any seeded team email (see below) and the `SEED_PASSWORD`.

### Seeded team logins

| Name | Email | Role |
|------|-------|------|
| Trey Wallette | `dewallette@gmail.com` | Director, Development |
| Kevin Crum | `kevin.crum@crescent.example` | Project Executive |
| Travis Rieff | `travis.rieff@crescent.example` | Construction |
| Linda Williams | `linda.williams@crescent.example` | Project Coordinator |

All share the `SEED_PASSWORD` from your `.env` (default `pulse-changeme-2026`).
**Change these before any shared/production use.** Update the placeholder
`@crescent.example` addresses to real emails in `prisma/seed-data.json` (or the
`User` table) so teammates can log in.

---

## Deploy to Vercel (shareable team URL)

The deploy is **self-seeding**: `vercel.json` runs `npm run vercel-build`, which
generates the Prisma client, pushes the schema, seeds the workbook data **only
if the database is empty**, then builds. So there are no manual database
commands — you just supply two connection strings and two secrets.

1. **Create a Postgres database** — [Neon](https://neon.tech) or
   [Supabase](https://supabase.com) (free tier). Copy **both** connection
   strings it gives you: the **pooled** one and the **direct** one.
2. **Import the repo into [Vercel](https://vercel.com)** → New Project →
   `trey891/tracker`. Add these environment variables:
   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | the **pooled** Postgres URL |
   | `DIRECT_URL` | the **direct** Postgres URL (used to push schema + seed) |
   | `AUTH_SECRET` | a random string — `openssl rand -base64 32` |
   | `SEED_PASSWORD` | the shared password for seeded team logins |
3. **Deploy.** First deploy creates the schema and loads all workbook data
   automatically. Subsequent deploys detect existing data and skip seeding, so
   in-app edits are never overwritten.
4. Open your Vercel URL and sign in as `dewallette@gmail.com` with
   `SEED_PASSWORD`.

> Re-seeding intentionally: set `SEED_FORCE=1` (env var) for one deploy to wipe
> and reload the seeded project. Remove it afterwards.

---

## Refreshing data from a new workbook

The importer is re-runnable. Point it at an updated `.xlsx`, regenerate the
seed, and re-seed (the seed wipes and recreates the project's rows, and upserts
users):

```bash
python3 scripts/extract_xlsx.py /path/to/new-workbook.xlsx
npm run db:seed
```

Going forward you'll mostly edit data **in the app** (Tasks are fully CRUD).
The financial/PCO/commitment tables are seeded from the workbook today; the data
model already stores them per-project, so add-in-app editing for those is a
natural next step.

---

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:push` | Sync Prisma schema to the database |
| `npm run db:seed` | Load workbook data + team users |
| `npm run db:reset` | Force-reset schema and reseed (destructive) |
| `npm run extract` | Re-parse the workbook into `prisma/seed-data.json` |

---

## Architecture notes

- **Multi-project**: every table is keyed by `projectId`. The UI currently
  targets the first project (`src/lib/data.ts`); add a project switcher / route
  param to expose more.
- **Auth**: Auth.js v5 credentials provider, JWT sessions, bcrypt-hashed
  passwords. Route protection runs in edge middleware; the DB lookup runs in
  Node (`src/auth.ts`). All mutations re-check the session server-side.
- **Data model**: `prisma/schema.prisma`. Financial figures are `Float` (report
  figures are already rounded); status / priority / workstream are validated
  strings (`src/lib/constants.ts`).
- **Charts** are dependency-free inline SVG (`src/components/Charts.tsx`).
