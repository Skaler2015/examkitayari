# Deployment

ExamsKiTayari ships as three roles from **one image**: the **web** server, the
**worker**, and the **scheduler**. They share the database; scale each
independently.

## Option A — Docker Compose (single host)

```bash
cp .env.example .env      # set AUTH_SECRET; adjust POSTGRES_* if desired
docker compose up -d --build
docker compose exec web npx prisma migrate deploy
docker compose exec web npm run db:seed
```

Services: `db` (Postgres), `redis`, `web` (:3000), `worker`, `scheduler`.
Volumes persist Postgres data, Redis AOF and uploaded objects (`storage`).

Scale workers: `docker compose up -d --scale worker=3`.

## Option B — Managed platform (e.g. Vercel/Render/Fly) + managed Postgres

1. **Web**: deploy the Next.js app. Set all env vars from `.env.example`.
2. **Database**: point `DATABASE_URL` at managed Postgres. Run
   `npx prisma migrate deploy` in a release/build step, then seed once.
3. **Automation** — pick one:
   - **Long-running**: run `npm run scheduler` and `npm run worker` as
     background services/containers (Render Background Worker, Fly process
     groups, a small VM, etc.).
   - **Serverless cron**: schedule `POST /api/cron/tick` (e.g. every 1–5 min)
     with header `Authorization: Bearer $AUTH_SECRET`. Each call enqueues due
     source crawls and drains a bounded batch within the request budget.

     Example Vercel `vercel.json`:
     ```json
     { "crons": [{ "path": "/api/cron/tick", "schedule": "*/2 * * * *" }] }
     ```
     (Add the Authorization header via a small wrapper route or an external
     scheduler that can send headers, e.g. GitHub Actions / cron-job.org.)

## Migrations

```bash
# create a migration during development
npx prisma migrate dev --name <change>
# apply in production
npx prisma migrate deploy
```

For a first bring-up without migration history you may use
`npx prisma db push` to sync the schema directly.

## Storage

- `STORAGE_DRIVER=local` writes PDFs/objects under `STORAGE_LOCAL_DIR`
  (mounted volume in Docker). Fine for a single host.
- `STORAGE_DRIVER=s3` uses an S3-compatible bucket. Set `S3_ENDPOINT`,
  `S3_BUCKET`, keys and `S3_PUBLIC_BASE_URL`. Swap in the AWS SDK in
  `src/server/storage/index.ts` for signed uploads if your bucket is private.

## Redis

Optional. When `REDIS_URL` is unset the app degrades gracefully (caching becomes
a no-op; the queue uses the database). Provide Redis for caching and future
BullMQ-based queueing at scale.

## Security checklist (production)

- Set a strong unique `AUTH_SECRET` (`openssl rand -base64 48`).
- Change the seeded admin password immediately.
- Serve over HTTPS (cookies are `secure` in production).
- Restrict `POST /api/cron/tick` (bearer token already enforced).
- Keep AI/DB/storage secrets in the platform secret store, never in the repo.
- Security headers are set in `next.config.mjs`; add a CDN/WAF as needed.

## Observability

- Structured JSON logs in production (`LOG_LEVEL`).
- `AutomationLog` records per-job logs; `AuditLog` records admin actions.
- Source health + recent crawls are visible on the admin dashboard.

## Backups

- Postgres: schedule `pg_dump` (or managed automated backups).
- Object storage: enable bucket versioning / lifecycle rules.

## Scaling notes

- Run multiple `worker` replicas — the DB queue uses optimistic locking.
- Keep a single `scheduler` (it only enqueues; it is idempotent per tick).
- Move to Redis/BullMQ and Elasticsearch/OpenSearch when volume grows; both are
  isolated behind existing interfaces (`server/queue`, `server/queries`).
