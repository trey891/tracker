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

## Storage monitoring & weekly CSV archive

The app stores everything — including progress photos and uploaded documents —
as rows in Postgres, so **database size** is the single number that decides when
you outgrow the free tier. Two features track and back that up:

**Storage & cost monitoring** (`/settings`, admin only). A live readout of
database size vs. the plan's storage allowance (default 0.5 GB = Neon free),
attachment storage broken down by kind, and row counts. It turns amber at 80%
and red at 100%, so you get warning before writes start failing. Adjust the
threshold with `USAGE_LIMIT_MB` / `USAGE_WARN_PCT` when you move to a paid plan.

**Weekly CSV archive email** — an off-platform backup. Every **Monday ~8 AM
Central** (Vercel Cron → `/api/cron/weekly-export`) the app emails a CSV of all
project data (tasks, cost tracking / PCOs, commitments, milestones, allowances,
financials — **no images**) plus the storage summary above, as an early cost
warning. Admins can also send it on demand from the Settings page.

To enable the email:
1. Create a free [Resend](https://resend.com) account. **Sign up with the same
   email you want the archive sent to** — Resend lets you send from
   `onboarding@resend.dev` to your own account address with no domain setup.
2. Create an API key and set these on Vercel (see `.env.example`):
   | Variable | Value |
   |----------|-------|
   | `RESEND_API_KEY` | your Resend API key |
   | `EXPORT_EMAIL` | recipient (default `dewallette@gmail.com`) |
   | `CRON_SECRET` | random string — `openssl rand -base64 32` (secures the cron endpoint) |
3. Redeploy. Until `RESEND_API_KEY` is set, the export safely no-ops and the
   Settings page shows "Not configured".

> Vercel's free (Hobby) plan runs cron jobs at most once per day, so a weekly
> schedule is well within limits.

## iOS app (Capacitor)

The app is packaged for iOS with [Capacitor](https://capacitorjs.com) as a thin
native shell that loads the deployed site and adds **native camera** (progress
photos) and **push notifications**. Because the app is server-rendered it can't
be statically exported, so the shell points at your live URL.

**Requirements:** an Apple Developer account ($99/yr), and either a Mac with
Xcode *or* a cloud iOS build service (EAS, Codemagic). The `ios/` Xcode project
is generated on the Mac — it isn't committed.

### Generate & run the iOS project (on a Mac)
```bash
npm install
export CAP_SERVER_URL="https://your-app.vercel.app"   # your production URL
npm run cap:add-ios      # creates ios/ (one time)
npm run cap:sync         # copies config + plugins
npm run cap:open         # opens Xcode
```
In Xcode: set your Team under **Signing & Capabilities**, add the **Push
Notifications** capability and **Background Modes → Remote notifications**, then
Run on a device (push doesn't work in the simulator). `Info.plist` will need
`NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` strings (Xcode
prompts, or add them once).

### Enable push notifications (optional)
1. In the Apple Developer portal create an **APNs Auth Key** (`.p8`), note the
   Key ID and your Team ID.
2. Add `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_KEY_P8`, and
   `APNS_PRODUCTION` to your server env (Vercel) — see `.env.example`.
3. The app registers each device on sign-in (`/api/devices`); a push is sent
   when a task moves to **Blocked**. Until the keys are set, push safely no-ops.

### Distribution
- **TestFlight** — free, install via a link; ideal for your own team.
- **Apple Business Manager → Custom Apps** — a private, unlisted app for your
  organization (the recommended long-term route for an internal tool).
- Public App Store listing is only needed to sell it beyond your org; note
  Apple's Guideline 4.2 — the native camera/push here help satisfy it.

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
