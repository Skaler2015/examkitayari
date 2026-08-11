# Architecture

ExamsKiTayari is a modular monolith: a single Next.js application plus two
lightweight background processes (scheduler + worker) that share the same
codebase and database. Every pipeline stage is an independent, testable module,
so new source types and exam organisations are added as **data**, never code.

## High-level diagram

```
                          ┌──────────────────────────┐
   Admin adds sources ───▶│   sources (DB table)     │
   (no code changes)      └───────────┬──────────────┘
                                      │ nextCrawlAt due
                          ┌───────────▼──────────────┐
                          │  scheduler  (workers/)   │  enqueues CRAWL_SOURCE
                          └───────────┬──────────────┘
                                      │ AutomationJob queue (DB)
                          ┌───────────▼──────────────┐
                          │   worker  (workers/)     │
                          └───────────┬──────────────┘
                                      │
   ┌──────────────────────────────────▼─────────────────────────────────────┐
   │ SOURCE MONITOR ▸ CHANGE DETECTION ▸ FETCH ▸ PARSE ▸ EXTRACT-TEXT ▸       │
   │ CLASSIFY ▸ EXTRACT-DATA ▸ DEDUPE ▸ AI-DRAFT ▸ VALIDATE                    │
   └──────────────────────────────────┬─────────────────────────────────────┘
                                      │
                    autoPublish? ─────┼───── manual review (default)
                          │                          │
                   ┌──────▼──────┐          ┌────────▼─────────┐
                   │  publish()  │◀─────────│  Admin → Review  │
                   └──────┬──────┘  approve └──────────────────┘
                          │
             SEO metadata + internal links + notifications + sitemap/RSS
```

## Data model (Prisma)

The schema (`prisma/schema.prisma`) groups into:

- **Auth / RBAC** — `User`, `Session` (opaque token hashed in DB → revocable), roles `ADMIN/EDITOR/REVIEWER/STUDENT`.
- **Master data** — `Organization`, `State`, `Category`, `Exam`.
- **Monitoring engine** — `Source`, `SourceCrawl`, `SourceItem`, `SourceChange`, `Document`, `DocumentVersion`.
- **Content records** — `Job`, `AdmitCard`, `Result`, `AnswerKey`, `ExamDate`, `Cutoff`, `MeritList`, `Notice`. Each carries provenance (`sourceId`, `sourceUrl`, `verificationStatus`, `lastVerifiedAt`).
- **Publishing** — `Article` (+ `ArticleVersion`, `ArticleSource`, `RelatedContent`), `SeoMetadata`, `Redirect`.
- **Review / audit** — `ReviewAction`, `AuditLog`.
- **Learning** — `Question`, `QuestionOption`, `QuestionExplanation`, `MockTest`, `MockTestQuestion`.
- **Students** — `ExamFollow`, `Bookmark`, `UserAttempt`, `UserPerformance`, `Notification`.
- **Automation control** — `AutomationSetting` (global + per-category), `AutomationJob`, `AutomationLog`.

## Pipeline modules

| Stage | Module | Notes |
|---|---|---|
| Polite HTTP | `server/crawler/http.ts` | robots.txt, per-host throttle, backoff, conditional (ETag/Last-Modified) requests, identifiable UA |
| RSS | `server/crawler/rss.ts` | GUID/URL/date change detection |
| Sitemap | `server/crawler/sitemap.ts` | sitemap index + `lastmod` + checksum |
| HTML listing | `server/crawler/html.ts` | link/title/date/PDF extraction, optional CSS-selector config |
| PDF | `server/crawler/pdf.ts` | download, SHA-256, size, page count, text, metadata |
| JSON API | `server/crawler/json.ts` | configurable field mapping, env-based credentials |
| Orchestration | `server/crawler/index.ts` | persists crawl + items + changes, updates source health |
| Classification | `server/pipeline/classify.ts` | ordered rule/keyword classifier (13 categories) |
| Extraction | `server/pipeline/extract.ts` | deterministic field extraction (dates, vacancy, fee, links…) |
| Dedupe | `server/pipeline/dedupe.ts` | URL / content-hash / title-similarity / PDF-hash |
| AI | `server/ai/*` | provider-agnostic, guardrailed; deterministic template fallback |
| Publish | `server/pipeline/publish.ts` | versioning, SEO, linking, notifications |
| Process | `server/pipeline/process.ts` | ties it all together per `SourceItem` |

## Change detection

`SourceItem` stores a `contentHash` (and, for PDFs, the document SHA-256).
On each crawl the orchestrator compares hashes and records a `SourceChange`
row typed `NEW / UPDATED / UNCHANGED / REMOVED / ERROR`. Updated items reset to
the `DISCOVERED` stage so the change is re-evaluated.

## Source health

Every crawl updates denormalised health fields on `Source`
(`lastCheckedAt`, `lastSuccessAt`, `nextCrawlAt`, `lastHttpStatus`,
`lastResponseMs`, `consecutiveFailures`, `lastError`). Consecutive failures
escalate status `ACTIVE → WARNING → ERROR`; a robots block sets `BLOCKED`.
The admin dashboard surfaces sources needing attention.

## Job queue

A dependency-light **database-backed queue** (`AutomationJob`) is the default so
the platform runs without Redis. `claimNextJob()` uses optimistic locking so
multiple workers can run concurrently. Jobs retry with exponential backoff up to
`maxAttempts`. A Redis/BullMQ driver can be layered behind the same
`enqueue()` interface later.

## Auth & RBAC

Sessions are random opaque tokens stored **hashed** in `Session` (revocable),
carried in a signed **httpOnly** JWT cookie. `lib/auth/rbac.ts` defines a role
hierarchy and a permission map; server actions/pages call
`requireRole` / `requirePermission`. Edge `middleware.ts` does a fast
signature-only check for `/admin` and `/dashboard`; full role checks live in the
route-group layouts.

## SEO

`server/seo/schema.ts` builds JSON-LD (WebSite + SearchAction, Organization,
Breadcrumb, NewsArticle, FAQPage). `publish()` writes `SeoMetadata` per article;
`app/sitemap.ts`, `app/robots.ts` and `app/feed.xml` expose sitemap/robots/RSS.
The architecture is search-engine friendly and ready for a News sitemap.
