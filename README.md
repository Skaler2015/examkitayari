# ExamsKiTayari.com

A production-grade, highly automated **Indian competitive-exam preparation & exam-update platform**.

ExamsKiTayari automatically **discovers → monitors → fetches → parses → classifies → extracts → de-duplicates → drafts (AI-assisted) → human-reviews → publishes** official exam updates — **Jobs, Admit Cards, Results, Answer Keys, Cut Offs, Merit Lists, Exam Dates and Notices** — while always preserving the **official source URL** and never fabricating exam information.

> **It does not depend on any single third-party job API.** It runs its own **configurable Official Source Monitoring Engine** that watches official government recruitment websites via RSS, sitemaps, HTML listing pages, PDFs and JSON endpoints. Sources are **data, added from the Admin Panel — never hardcoded in application logic.**

---

## Table of contents
- [Tech stack](#tech-stack)
- [The automated pipeline](#the-automated-pipeline)
- [Quick start (local)](#quick-start-local)
- [Quick start (Docker)](#quick-start-docker)
- [Environment variables](#environment-variables)
- [Running the automation](#running-the-automation)
- [Project structure](#project-structure)
- [Admin workflow](#admin-workflow)
- [Accuracy & safety guarantees](#accuracy--safety-guarantees)
- [Further docs](#further-docs)

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn-style UI |
| Backend | Next.js Route Handlers + Server Actions (REST), server-only service modules |
| Workers | Standalone Node worker + scheduler processes (DB-backed job queue) |
| Database | PostgreSQL (Prisma ORM) |
| Cache / Queue | Redis (optional — graceful in-memory / DB fallback) |
| Storage | S3-compatible object storage (local-disk driver for dev) |
| Auth | Custom JWT sessions (httpOnly cookies) + bcrypt + RBAC |
| Search | PostgreSQL search (architecture ready for Elasticsearch/OpenSearch) |
| Deployment | Docker + docker-compose (web + worker + scheduler + db + redis) |

## The automated pipeline

```
OFFICIAL SOURCE → SOURCE MONITOR → CHANGE DETECTION → CONTENT FETCHER →
HTML/PDF PARSER → DOCUMENT TEXT EXTRACTION → CONTENT CLASSIFICATION →
DATA EXTRACTION → DUPLICATE DETECTION → AI PROCESSING → VALIDATION →
ADMIN REVIEW → PUBLISH → SEO INDEXING → NOTIFICATION
```

Each stage is an inspectable module under `src/server/` (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)). Every produced record stores `sourceId`, `sourceUrl`, `verificationStatus`, `createdAt`, `updatedAt` and a `lastVerifiedAt` timestamp.

---

## Quick start (local)

Prerequisites: **Node 20+**, **PostgreSQL 14+**, (optional) **Redis 6+**.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#   → set DATABASE_URL (and AUTH_SECRET: openssl rand -base64 48)

# 3. Create the schema + seed admin, categories, example sources
npx prisma migrate dev --name init      # or: npx prisma db push
npm run db:seed

# 4. Run the app
npm run dev                              # http://localhost:3000

# 5. In separate terminals, run the automation (optional in dev)
npm run scheduler                        # enqueues due source crawls
npm run worker                           # processes the pipeline
```

Log in at **`/login`** with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) and open **`/admin`**.

## Quick start (Docker)

```bash
cp .env.example .env         # set AUTH_SECRET at minimum
docker compose up -d --build

# First run only: apply schema + seed
docker compose exec web npx prisma migrate deploy
docker compose exec web npm run db:seed
```

This starts **db, redis, web (:3000), worker and scheduler**. The compose file overrides `DATABASE_URL`/`REDIS_URL` so containers reach the internal `db`/`redis` services automatically.

---

## Environment variables

See [`.env.example`](.env.example) for the fully documented list. The essentials:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret used to sign session JWTs (**required**, keep secret) |
| `REDIS_URL` | Redis connection (optional) |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | Server-side AI provider (`anthropic` / `openai` / `disabled`) |
| `CRAWLER_USER_AGENT` | Identifies the crawler to websites (**must identify the bot**) |
| `AUTOMATION_ENABLED` | Master switch for scheduled crawling |
| `STORAGE_DRIVER` | `local` or `s3` for PDF/object storage |

**Secrets are never exposed to the browser.** AI keys, DB passwords and storage keys are read only in server modules.

## Running the automation

There are two ways to drive the pipeline:

1. **Long-running processes** (recommended for VMs/containers): `npm run scheduler` + `npm run worker`. The scheduler enqueues due sources; workers drain the DB-backed queue.
2. **Serverless cron** (e.g. Vercel Cron / GitHub Actions): `POST /api/cron/tick` with header `Authorization: Bearer $AUTH_SECRET`. Each call enqueues due crawls and drains a bounded batch of jobs.

Crawl cadence is per-source (`frequencyMinutes`) and priority-ordered — configured entirely from **Admin → Sources**.

---

## Project structure

```
prisma/
  schema.prisma          # full data model (users, sources, pipeline, content, SEO, automation…)
  seed.ts                # bootstrap admin, categories, states, example sources
src/
  app/
    (public)/            # public site: home, jobs, admit-card, results, answer-key, exams, search…
    (auth)/              # login / register
    admin/               # dashboard, sources, review, automation, articles, audit
    dashboard/           # student area: follows, bookmarks, history, performance, notifications
    api/                 # cron/tick, search
    sitemap.ts robots.ts feed.xml/   # SEO surfaces
  components/            # UI primitives + shared + site chrome
  lib/                   # env, prisma, redis, logger, utils, auth (password/session/rbac), format
  server/
    crawler/             # http (polite fetch + robots), rss, sitemap, html, pdf, json adapters
    pipeline/            # classify, extract, dedupe, linking, publish, process (orchestrator)
    ai/                  # provider-agnostic AI + content generation (guardrailed)
    automation/          # per-category automation settings
    queue/               # DB-backed job queue + runner
    seo/                 # JSON-LD schema builders
    storage/             # object storage (local/S3)
    notifications/       # follower notifications
    actions/             # server actions (auth, sources, review, automation, audit, student)
    queries.ts           # read models for pages
  workers/
    scheduler.ts         # enqueues due source crawls
    index.ts             # job worker loop
```

## Admin workflow

```
ADMIN LOGIN → Dashboard → New Updates → Review (source vs extracted vs draft)
→ Approve/Edit/Reject/Mark-Duplicate → Publish → Monitor sources → Analytics
```

- **Add a source without touching code:** Admin → Sources → Add Source (name, org, URLs, type, frequency, priority, keywords, allow/exclude URL patterns, monitored categories).
- **Automation switches:** Admin → Automation (global + per-category toggles for monitoring, AI, auto-classify, auto-draft, auto-publish, SEO, sitemap, notifications). Jobs / Admit Cards / Results / Answer Keys / Notices default to **manual review**.

## Accuracy & safety guarantees

- **Official source is always preserved and displayed** (source name, URL, published/updated, last-verified, status).
- **AI never invents facts.** Factual fields (vacancy, dates, eligibility, fees, links, results) come only from deterministic extraction of official text. AI is used solely to *format* verified data, behind strict guardrails; when AI is disabled the system falls back to deterministic templates.
- **Missing data shows “Not Available in Official Source”** — never a guess.
- **Conflicting sources** can be flagged (`SOURCE_CONFLICT`) and routed to manual review.
- **Polite crawling:** robots.txt respected, per-host throttling, exponential backoff, conditional requests, retry limits, and a clearly-identified user-agent.

## Further docs

- [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) — **one-click-ish deploy to Vercel + Neon with auto-deploy on every push** (recommended; keeps your domain)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — modules, data model, pipeline internals
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Docker/VPS deployment, scaling, cron, storage, backups
- [`docs/API.md`](docs/API.md) — HTTP endpoints and server actions

---

_Information on this platform is compiled from official sources and always links back to them. Always verify final details on the official website._
