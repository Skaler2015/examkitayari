# Deploy to Vercel + Neon (auto-deploy on every push)

This is the recommended path for `examskitayari.com`. Once connected, **every
`git push` to `main` auto-deploys**. Your Hostinger domain keeps working — we
just point its DNS at Vercel.

> Why not Hostinger shared hosting? This app needs a Node.js server (SSR),
> PostgreSQL, and a scheduled pipeline. Shared "Cloud Hosting" (hPanel) can't run
> those. Vercel runs the Next.js app; Neon provides PostgreSQL; a free external
> cron drives the monitoring pipeline.

## What you'll set up (once)

1. A **Neon** PostgreSQL database (free).
2. A **Vercel** project connected to this GitHub repo (free Hobby plan works).
3. Point **examskitayari.com** DNS to Vercel.
4. An **external cron** (cron-job.org) to run the monitoring pipeline every few minutes.

---

## Step 1 — Create the database (Neon)

1. Sign up at <https://neon.tech> → **Create project** (region: choose closest, e.g. Singapore/Mumbai).
2. In the project **Dashboard → Connection Details**, copy **two** connection strings:
   - **Pooled** connection (host contains `-pooler`) → this is your `DATABASE_URL`.
   - **Direct** connection (no `-pooler`) → this is your `DIRECT_URL`.
   - Make sure each ends with `?sslmode=require`.

## Step 2 — Import the repo into Vercel

1. Sign up at <https://vercel.com> with your GitHub account.
2. **Add New → Project** → import `Skaler2015/examkitayari`.
3. Framework is auto-detected (Next.js). The build command is already set by
   `vercel.json` (`prisma generate && prisma migrate deploy && next build`), so the
   database schema is created automatically on the first deploy.
4. Add **Environment Variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** URL (…`-pooler`…`?sslmode=require`) |
   | `DIRECT_URL` | Neon **direct** URL (…`?sslmode=require`) |
   | `AUTH_SECRET` | a long random string (`openssl rand -base64 48`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://examskitayari.com` |
   | `NEXT_PUBLIC_SITE_NAME` | `ExamsKiTayari` |
   | `SETUP_TOKEN` | a random string (used once, next step) |
   | `CRON_SECRET` | a random string (used by cron) |
   | `SEED_ADMIN_EMAIL` | your admin email |
   | `SEED_ADMIN_PASSWORD` | a strong admin password |
   | `AI_PROVIDER` | `disabled` (or `anthropic`/`openai` later) |
   | `AI_API_KEY` | your AI key (optional, later) |
   | `AI_MODEL` | e.g. `claude-sonnet-5` |
   | `CRAWLER_USER_AGENT` | `ExamsKiTayariBot/1.0 (+https://examskitayari.com/bot)` |

5. Click **Deploy**. First deploy runs the migration and builds the site.

## Step 3 — Finish setup (creates admin + example sources)

Open this once in your browser (replace the token with your `SETUP_TOKEN`):

```
https://<your-vercel-url>/api/setup?token=YOUR_SETUP_TOKEN
```

You should see `"ok": true`. Now log in at `/login` with your admin email/password
and open `/admin`. **Change the admin password / delete SETUP_TOKEN afterwards.**

## Step 4 — Point your domain (examskitayari.com)

1. In Vercel: **Project → Settings → Domains → Add** `examskitayari.com` (and `www`).
2. Vercel shows the DNS records to set. In **Hostinger hPanel → Domains → DNS**:
   - Set the `A` record for `@` to Vercel's IP (e.g. `76.76.21.21`), **or**
   - Follow Vercel's instruction to set `CNAME` for `www` to `cname.vercel-dns.com`.
   Use exactly the values Vercel shows for your project.
3. Wait for DNS to propagate (minutes to a few hours). Vercel issues SSL automatically.

## Step 5 — Drive the monitoring pipeline (cron)

`vercel.json` runs `/api/cron/tick` **every 5 minutes**. On the **Pro** plan this
works out of the box (Vercel sends the `CRON_SECRET` bearer automatically), so no
external service is needed — the pipeline runs itself.

**On the free (Hobby) plan** Vercel cron is limited to **once per day**. If you're
on Hobby, either change the schedule in `vercel.json` to `0 2 * * *`, or add a free
external cron for frequent monitoring:

1. Sign up at <https://cron-job.org> (free).
2. Create a cronjob:
   - **URL:** `https://examskitayari.com/api/cron/tick`
   - **Schedule:** every 5–15 minutes
   - **Request method:** `POST`
   - **Header:** `Authorization: Bearer YOUR_CRON_SECRET`
3. Save. Each run enqueues due source crawls and processes the pipeline.

(Alternative: the included `.github/workflows/cron.yml` does the same from GitHub
Actions — set repo secrets `SITE_URL` and `CRON_BEARER = your CRON_SECRET`.)

---

## After this: automatic changes

From now on, **any change you push to `main` on GitHub deploys automatically**
to `examskitayari.com`. Content updates (jobs, admit cards, results, answer keys)
are discovered by the pipeline on each cron tick and appear after you approve them
in **Admin → Pending Review** (or automatically if you enable auto-publish per
category in **Admin → Automation**).

## Notes & limits

- **Serverless has no long-running workers.** On Vercel the `worker`/`scheduler`
  processes don't run; the `/api/cron/tick` endpoint does the same work per tick.
  If you later want continuous, high-volume monitoring, move to a VPS with the
  included Docker Compose (`docs/DEPLOYMENT.md`) — the code is identical.
- **Uploaded PDFs:** set `STORAGE_DRIVER=s3` with an S3-compatible bucket for
  persistence (Vercel's filesystem is ephemeral). The local driver is fine for
  testing.
- Keep secrets in Vercel's Environment Variables — never commit them.
