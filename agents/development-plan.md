# Site Analyzer – Development Plan

This plan implements a small site analyzer that:

- Accepts a site URL from a page in the app
- Fetches the site's `sitemap.xml` and saves all URLs to MongoDB
- Runs a worker that reads queued URLs and uses Playwright to fetch each page's content
- Displays a simple dashboard to monitor link statuses and view stored content
- Provides a Sites section to browse domains and per-site dashboards
- Includes SEO analysis to surface common issues (missing title/meta, slow pages, non-200s)
  and extended checks (missing canonical, title length bounds, duplicate titles/meta)

MongoDB (dev) is reachable at `mongodb://localhost:27017` with default DB `sv-app`. You can change these in `docker-compose.yml` or `.env`.

## Stack

- App: SvelteKit (existing project)
- Database: MongoDB (local via Docker)
- Headless browser: Playwright (Chromium)
- Language: TypeScript

## Environment configuration

- `.env` (dev example):
  - `MONGODB_URI=mongodb://localhost:27017`
  - `MONGODB_DB=sv-app`
  - `PLAYWRIGHT_HEADLESS=true`
  - `WORKER_CONCURRENCY=3`
  - `WORKER_MAX_ATTEMPTS=3`
  - `LEASE_TIMEOUT_MS=900000` (15 min)
  - Optional: `PLAYWRIGHT_SCREENSHOTS=true` to capture page screenshots under `static/screenshots`
  - Optional: `DEV_API_TOKEN=...` to protect dev endpoints via `x-dev-token` header

Note: If you keep Mongo auth enabled, add `MONGODB_URI` with creds accordingly.

## Data model

### Collection: `links`

- `_id: ObjectId`
- `siteId: string` (normalized identifier for the site, e.g., hostname)
- `url: string`
- `status: 'pending' | 'in_progress' | 'done' | 'error'`
- `attempts: number` (default 0)
- `lastError: string | null`
- `leasedAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`
- Optional: `depth: number | null` (if crawl depth is later needed)

Indexes:

- Unique: `{ siteId: 1, url: 1 }`
- `{ status: 1 }`
- `{ siteId: 1, status: 1 }`

### Collection: `pages`

- `_id: ObjectId`
- `siteId: string`
- `url: string`
- `statusCode: number | null`
- `fetchedAt: Date`
- `contentType: string | null`
- `title: string | null`
- `titleLength: number | null`
- `meta: Record<string, string> | null` (e.g., description)
- `metaDescription: string | null`
- `loadTimeMs: number | null`
- `canonicalUrl: string | null`
- `content: string` (HTML/text; cap size)
- `textContent: string | null` (extracted plain text)
- `textExcerpt: string` (sanitized preview for UI)
- Optional: `contentHash: string`, `screenshotPath: string | null`
- Optional metrics: `contentLength: number | null`, `wordCount: number | null`

Indexes:

- Unique: `{ siteId: 1, url: 1 }`
- `{ fetchedAt: -1 }`

## High-level flow

1. User opens Analyzer page and submits a site URL
2. Server fetches and parses `sitemap.xml`, bulk upserts URLs into `links` with `status=pending`
3. Worker process continuously leases pending links, marks them `in_progress`, fetches pages with Playwright
4. Worker writes fetched content to `pages`, updates `links` to `done` or `error`
5. Analyzer UI shows status counts and a list of links; clicking a link shows stored content

## Backend components

### 1) Mongo client utility

- File: `src/lib/server/db.ts`
- Singleton Mongo client with lazy initialization
- Exports `getDb()` and typed getters for `links` and `pages`

### 2) Sitemap ingestion endpoint

- File: `src/routes/api/ingest/+server.ts`
- Method: `POST`
- Input: `{ siteUrl: string }`
- Steps:
  - Normalize `siteUrl` (derive `siteId`)
  - Resolve and fetch `sitemap.xml` (handle `sitemap_index.xml` variants)
  - Parse with fast-xml-parser; support multiple sitemap files
  - Bulk upsert all URLs into `links` with `status=pending`
- Response: `{ siteId, inserted: number, pendingTotal: number }`

### 3) Status and data APIs

- `GET src/routes/api/status/+server.ts`
  - Query: `?siteId=...`
  - Returns counts by status `{ pending, in_progress, done, error, total }`

- `GET src/routes/api/links/+server.ts`
  - Query: `?siteId=&status=&page=&limit=&q=`
  - Paginated list of links (with basic search by URL)
  - Supports `sortBy` (updatedAt|url|status|attempts) and `sortDir` (asc|desc)
  - Includes `pageId` when a stored page exists

- `GET src/routes/api/page/[id]/+server.ts`
  - Params: `id` (Mongo `_id` string)
  - Returns the stored page record (sanitized preview fields for UI consumption)

- `GET src/routes/api/health/+server.ts`
  - Pings DB for quick readiness checks

- Dev convenience endpoints (guarded in production; optional token via `DEV_API_TOKEN`):
  - `POST src/routes/api/process-batch/+server.ts` — processes a small batch immediately
  - `POST src/routes/api/reset-site/+server.ts` — deletes links/pages for a site
  - `POST src/routes/api/links/batch/+server.ts` — batch retry/purge selected link ids

- Resume endpoint:
  - `POST src/routes/api/resume/+server.ts` — resume processing for a site
    - Query: `?siteId=...&mode=all|retry-errors`
    - Requeues stale `in_progress` links and retries `error` links under the attempts cap
    - Response: `{ requeuedStale: number, retriedErrors: number }`

- Sites & pages APIs:
  - `GET src/routes/api/sites/+server.ts` — list all sites with counts and lastUpdated
  - `GET src/routes/api/pages/+server.ts` — list pages per site with pagination/search/sort
  - `GET src/routes/api/seo/+server.ts` — SEO aggregates for a site (missing title/meta, slow pages by threshold, non-200)
    - Also reports missing canonical, title length issues (min/max bounds), and duplicates for titles/meta

## Worker process

- File: `scripts/worker.ts` (Node/TS)
- Concurrency via a small pool; loop until no jobs, then sleep briefly
- Lease pattern:
  - `findOneAndUpdate({ status:'pending' }, { $set: { status:'in_progress', leasedAt: now }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 } })`
  - If a job is `in_progress` longer than `LEASE_TIMEOUT_MS` and `attempts < WORKER_MAX_ATTEMPTS`, requeue to `pending`
- Fetching implementation:
  - Launch Chromium headless once per worker (reuse browser)
  - For each URL: `page.goto(url, { waitUntil: 'networkidle', timeout: ... })`
  - Extract: status code, title, meta description, content type, content HTML, build `textExcerpt`
  - Measure `loadTimeMs` as wall-clock duration of navigation+render
  - Extract canonical URL and plain text (`textContent`) for metrics
  - Compute `titleLength`, `contentLength`, `wordCount` for SEO analysis
  - Optional: capture screenshot when enabled
  - Cap content length (e.g., 2–4 MB), compute hash optionally
  - Upsert in `pages` and set `links.status = 'done'` or `'error'` with `lastError`

Optional enhancements:

- Screenshots to a local folder; store path in `pages`
- Respect `robots.txt` if needed (out of scope initially)

## Frontend (SvelteKit)

### Navigation & layout

- Add a side drawer layout with links to Home, Analyzer, Sites
- Add a compact theme toggle button (system/light/dark) with persistence (localStorage)
  - Apply theme early (pre-paint) and use DaisyUI themes (light/dark variants)

### Analyzer page

- File: `src/routes/analyzer/+page.svelte`
- UI:
  - Form to submit site URL -> calls `POST /api/ingest`
  - Site selector dropdown to choose an existing site (fetched from `/api/sites`)
    - Persists last selection in localStorage and restores on load
    - Supports deep-link via `?siteId=...` query param
  - Status summary (counts by status) -> calls `/api/status?siteId=...`, auto-refresh every 5–10s
  - Table of links with filters: status, search, pagination -> `/api/links?...`
  - Column sorting and quick "only errors" toggle
  - Multi-select with batch actions: retry, purge errors
  - Resume actions: "Resume all" and "Retry errors" buttons call `POST /api/resume`
  - Each row links to content view page

### Content view page

- File: `src/routes/analyzer/page/[id]/+page.svelte`
- Fetch via `/api/page/[id]`
- Show: status code, fetchedAt, title, meta, and a sanitized preview (`textExcerpt`); optional toggle for raw HTML in a safe container
  - Show screenshot when available

### Sites section

- `/sites` — list all sites with counts
- `/sites/[siteId]` — per-site dashboard with status cards, links table and pages table (filters/sort/pagination)
  - Header actions include Resume buttons (all / retry-errors) and optional Reset (dev-only)
- `/sites/[siteId]/seo` — SEO analysis dashboard with summary metrics and samples; adjustable slow threshold
  - Shows missing canonical, short/long titles, duplicates (titles/meta), slow pages, missing title/meta, non-200

## Dependencies to add

- `mongodb` (official driver)
- `fast-xml-parser` (sitemap parsing)
- `sanitize-html` (safe rendering preview server-side)
- `zod` (validate inputs and API responses)
- `p-limit` (optional, control concurrency)
- Playwright already present; ensure Chromium is installed (`npx playwright install chromium`)
 - Optional (future): text similarity for duplicate clustering (e.g., `string-similarity` or implement shingling)

## Scripts (package.json)

- `"worker": "tsx scripts/worker.ts"` (or use `node` after building to JS)
- `"dev:worker": "tsx scripts/worker.ts --watch"` (optional during dev)

## Testing plan

- Unit tests
  - URL normalization and `siteId` derivation
  - Sitemap parsing (regular XML, sitemap index, gzipped optional later)
  - Leasing logic transitions and retry policy

- Integration tests
  - `POST /api/ingest` bulk upserts with dedupe
  - Worker processes a batch and writes to `pages`; `links` move to `done`/`error`
  - SEO API returns expected aggregates given seeded pages
  - `/api/status` and `/api/links` return expected aggregates

- E2E (Playwright)
  - Analyzer UI: submit URL, see pending -> done as worker runs
  - Content view displays sanitized preview, metadata, and screenshot when enabled
  - Sites list and site detail navigation works; SEO dashboard shows expected counts

## Homepage dashboard (planned)

Goal: a landing page that summarizes recent activity and key health metrics across all sites, with quick links into Analyzer/Sites/SEO.

Data sources
- `/api/sites` for per-site counts and lastUpdated
- `/api/seo?siteId=...` for per-site SEO metrics (optionally sampled)
- Potential new endpoint `/api/overview` to aggregate:
  - total sites, total pages analyzed, total errors, average load time (across recent N pages), top slow sites
  - Implementation v1 can compute on the client by fetching `/api/sites` and sampling recent pages per site

UI/UX
- Cards: total sites, pages analyzed, pages with errors, avg load time (recent window)
- Recent sites list with quick actions: Open Analyzer (pre-select site), Site dashboard, SEO page
- Small chart of errors over time (optional v2)

Acceptance criteria
- Visiting `/` renders cards with correct counts and a list of sites
- Links navigate correctly using `resolve()` for internal routes
- No blocking on large data; degrades gracefully if some APIs fail (shows partial with alerts)

## Toasts/notifications (planned)

Design
- Use DaisyUI `toast` component; create a small Svelte store (e.g., `lib/stores/toast.ts`) with helpers: `success`, `error`, `info`
- Render a toasts container in `+layout.svelte` so any page can push notifications
- Replace inline alerts in Analyzer/Sites with ephemeral toasts for: ingest, batch actions, reset, resume

API
- Store shape: `{ id: string; type: 'success'|'error'|'info'; message: string; timeout?: number }`
- Helpers auto-expire after N ms; manual dismissal supported

Acceptance criteria
- Actions trigger a visible toast that auto-hides; multiple toasts queue without overlap
- No TypeScript errors; Svelte lint clean

## Server-side rate limiting (planned)

Design
- Lightweight in-memory token bucket keyed by client IP (or `x-dev-token` when present)
- Global config via `.env`: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_TOKENS`, optional `RATE_LIMIT_BURST`
- Implement in `hooks.server.ts` or a small wrapper used by dev endpoints; bypass when `dev` is true unless `DEV_API_TOKEN` is set

Scope (initial)
- Protect dev endpoints: `POST /api/process-batch`, `POST /api/reset-site`, `POST /api/links/batch`, and optionally `POST /api/resume`

Acceptance criteria
- Exceeding rate returns 429 with JSON `{ error: 'rate_limited' }`
- Limits reset after window; per-IP accounting works locally
- Configurable and disabled when variables are absent

## Duplicate content detection (planned)

Phase 1: Exact duplicates
- Add `contentHash` (e.g., sha256 of normalized `textContent`) to `pages`
- Index `{ siteId: 1, contentHash: 1 }`
- SEO API: add summary of duplicate groups by `contentHash` with sample URLs

Phase 2: Near-duplicates (optional)
- Implement shingling + Jaccard or cosine similarity (bag-of-words) on `textContent`
- Compute signatures as a background job; store group ids or similarity scores
- UI: SEO page adds a "Duplicate content" section with groups and representative pages

Acceptance criteria
- Exact duplicates detected correctly on seeded data (>=2 pages with identical `textContent`)
- API returns groups with counts and example URLs; UI lists them
- Near-duplicate path is feature-flagged and can be postponed

## Changelog

- 2025-10-26
  - Added Resume endpoint to backend and wired Resume actions in Analyzer and per-site pages
  - Analyzer gained site selector, local persistence, and query param restore
  - Development plan expanded with dashboard/toasts/rate limiting/duplicate content details

## Milestones & acceptance criteria

### Phase 1: Foundations (DB + Ingestion + UI skeleton)

- DB util `db.ts` with health check (able to connect)
- `POST /api/ingest` stores pending links (dedupe via unique index)
- `/analyzer` page with submit form and live status summary (even if mocked at first)

### Phase 2: Worker + Content

- Worker claims jobs, fetches pages, writes to `pages`, updates statuses
- Content view shows title/meta/excerpt safely
- Links table supports pagination and status filtering

### Phase 3: Robustness + UX polish

- Lease timeout requeue + backoff retries
- Error visibility per link; optional screenshots
- Batch operations on links (retry/purge)
- SEO dashboard with missing title/meta, slow pages, and non-200 counts
  - Extended SEO checks: missing canonical, title length bounds, duplicate titles/meta
- Indexes in place; content size limits enforced

### Phase 4: SEO & DX enhancements (completed)

- Worker stores canonical URL, text-only content, and SEO metrics (titleLength, contentLength, wordCount)
- SEO API returns additional aggregates (canonical, title length issues, duplicate titles/meta)
- SEO UI renders the new metrics and sample tables
- Batch operations on Analyzer polished; internal navigation uses `resolve()` for base-path safety
- Lint/type fixes aligned with Svelte 5 (e.g., SvelteURLSearchParams, SvelteSet)

### Phase 5: Operations & UX refinements (completed)

- Resume capability surfaced end-to-end
  - Server: `POST /api/resume` requeues stale leases and retries errors (under cap)
  - UI: Analyzer + per-site pages show "Resume all" and "Retry errors" buttons with success alerts
- Analyzer improvements
  - Site selector loads from `/api/sites`, persists last selection, supports `?siteId` deep-link
  - External links open with direct hrefs; internal links continue to use `resolve()`
- DX: ambient TS declarations added for Svelte 5 helpers used in templates

### Next steps (planned)

- Homepage dashboard: recent sites, quick stats (pages analyzed, errors, avg load time), and shortcuts
- Toasts/notifications framework (replace inline alerts for ingest/batch/reset/resume)
- Server-side rate limiting (in-memory token bucket) for dev endpoints
- Duplicate content detection using `contentHash`/`textContent` clustering

## Risks & mitigations

- Large/complex sitemaps → stream parsing or chunked ingestion; handle sitemap index
- Sites requiring auth/JS rendering quirks → log errors; optionally add per-site overrides later
- Stuck jobs → lease timeout + requeue, attempts cap
- XSS from stored HTML → sanitize on read; restrict UI to excerpts by default

## Operational notes

- Dev convenience: run Mongo without auth at `mongodb://localhost:27017` and DB `sv-app`
- If using auth, mirror credentials in `.env` and update connection strings
- Dev endpoints available for convenience; protect with `DEV_API_TOKEN` if sharing environments

## File scaffold (to be created in implementation)

- `src/lib/server/db.ts`
- `src/lib/server/sitemap.ts` (parse/normalize helpers)
- `src/routes/api/ingest/+server.ts`
- `src/routes/api/status/+server.ts`
- `src/routes/api/links/+server.ts`
- `src/routes/api/page/[id]/+server.ts`
- `src/routes/analyzer/+page.svelte`
- `src/routes/analyzer/page/[id]/+page.svelte`
- `scripts/worker.ts`
