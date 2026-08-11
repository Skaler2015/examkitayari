# API & Server Actions

The platform uses Next.js Route Handlers for machine endpoints and Server
Actions for form/mutations. All mutations enforce RBAC.

## HTTP endpoints

### `GET /api/search?q=<term>&category=<CATEGORY?>`
Instant global search over published articles. Returns:
```json
{ "query": "ssc cgl", "results": [
  { "title": "...", "category": "JOB", "url": "/jobs/...", "summary": "...", "publishedAt": "..." }
] }
```

### `POST /api/cron/tick`
Serverless automation driver. **Requires** header
`Authorization: Bearer <AUTH_SECRET>`. Enqueues due source crawls and drains a
bounded batch of queued jobs. Returns:
```json
{ "ok": true, "enabled": true, "enqueued": 5, "processed": 12 }
```

### SEO surfaces
- `GET /sitemap.xml` — dynamic sitemap (static routes + published articles + exams)
- `GET /robots.txt` — robots policy
- `GET /feed.xml` — RSS feed of the latest 50 published updates

## Server Actions (RBAC-guarded)

### Auth — `src/server/actions/auth.ts`
- `loginAction(prev, formData)` — email+password → session cookie, redirects.
- `registerAction(prev, formData)` — student sign-up (password policy enforced).
- `logoutAction()` — revokes session, redirects home.

### Sources — `src/server/actions/sources.ts` (perm `sources:write`)
- `saveSource(prev, formData)` — create/update a monitored source (all fields).
- `toggleSource(id, isActive)` — enable/disable.
- `deleteSource(id)` — remove.
- `crawlNow(id)` — enqueue an immediate crawl.

### Review — `src/server/actions/review.ts`
- `approveAndPublish(articleId)` (perm `articles:publish`) — mark human-verified & publish.
- `rejectArticle(articleId, note?)` (perm `review:act`).
- `markDuplicate(articleId)` (perm `review:act`).
- `saveArticleEdits(prev, formData)` (perm `articles:write`).

### Automation — `src/server/actions/automation.ts` (perm `automation:manage`)
- `saveAutomationSettings(scope, formData)` — persist toggles for `GLOBAL` or a category.

### Student — `src/server/actions/student.ts`
- `followExam(examId)` / `unfollowExam(examId)`
- `toggleBookmark(entityType, entityId)`
- `markNotificationsRead()`
- `saveAttempt(...)` — persist a mock-test attempt.

## Extending the engine

- **New source type:** implement a `SourceAdapter` (`crawl(source) => CrawlOutcome`)
  in `src/server/crawler/`, register it in `pickAdapter()` (`crawler/index.ts`).
- **New content category:** add to the `ContentCategory` enum + classifier rules
  (`pipeline/classify.ts`) and, if it needs structured fields, an extractor
  (`pipeline/extract.ts`) and a typed record in `process.ts`.
- **New AI provider:** add a branch in `src/server/ai/provider.ts`.
