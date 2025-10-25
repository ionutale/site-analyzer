# Site Analyzer – Development Plan

This plan implements a small site analyzer that:
- Accepts a site URL from a page in the app
- Fetches the site's `sitemap.xml` and saves all URLs to MongoDB
- Runs a worker that reads queued URLs and uses Playwright to fetch each page's content
- Displays a simple dashboard to monitor link statuses and view stored content

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
- `meta: Record<string, string> | null` (e.g., description)
- `content: string` (HTML/text; cap size)
- `textExcerpt: string` (sanitized preview for UI)
- Optional: `contentHash: string`, `screenshotPath: string | null`

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

- `GET src/routes/api/page/[id]/+server.ts`
  - Params: `id` (Mongo `_id` string)
  - Returns the stored page record (sanitized preview fields for UI consumption)

## Worker process

- File: `scripts/worker.ts` (Node/TS)
- Concurrency via a small pool; loop until no jobs, then sleep briefly
- Lease pattern:
  - `findOneAndUpdate({ status:'pending' }, { $set: { status:'in_progress', leasedAt: now }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 } })`
  - If a job is `in_progress` longer than `LEASE_TIMEOUT_MS` and `attempts < WORKER_MAX_ATTEMPTS`, requeue to `pending`
- Fetching implementation:
  - Launch Chromium headless once per worker (reuse browser)
  - For each URL: `page.goto(url, { waitUntil: 'networkidle', timeout: ... })`
  - Extract: status code, title, meta description, content HTML, build `textExcerpt`
  - Cap content length (e.g., 2–4 MB), compute hash optionally
  - Upsert in `pages` and set `links.status = 'done'` or `'error'` with `lastError`

Optional enhancements:
- Screenshots to a local folder; store path in `pages`
- Respect `robots.txt` if needed (out of scope initially)

## Frontend (SvelteKit)

### Navigation
- Add a link in `src/routes/+layout.svelte` to `/analyzer`

### Analyzer page
- File: `src/routes/analyzer/+page.svelte`
- UI:
  - Form to submit site URL -> calls `POST /api/ingest`
  - Status summary (counts by status) -> calls `/api/status?siteId=...`, auto-refresh every 5–10s
  - Table of links with filters: status, search, pagination -> `/api/links?...`
  - Each row links to content view page

### Content view page
- File: `src/routes/analyzer/page/[id]/+page.svelte`
- Fetch via `/api/page/[id]`
- Show: status code, fetchedAt, title, meta, and a sanitized preview (`textExcerpt`); optional toggle for raw HTML in a safe container

## Dependencies to add
- `mongodb` (official driver)
- `fast-xml-parser` (sitemap parsing)
- `sanitize-html` (safe rendering preview server-side)
- `zod` (validate inputs and API responses)
- `p-limit` (optional, control concurrency)
- Playwright already present; ensure Chromium is installed (`npx playwright install chromium`)

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
  - `/api/status` and `/api/links` return expected aggregates

- E2E (Playwright)
  - Analyzer UI: submit URL, see pending -> done as worker runs
  - Content view displays sanitized preview and metadata

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
- Indexes in place; content size limits enforced

## Risks & mitigations
- Large/complex sitemaps → stream parsing or chunked ingestion; handle sitemap index
- Sites requiring auth/JS rendering quirks → log errors; optionally add per-site overrides later
- Stuck jobs → lease timeout + requeue, attempts cap
- XSS from stored HTML → sanitize on read; restrict UI to excerpts by default

## Operational notes
- Dev convenience: run Mongo without auth at `mongodb://localhost:27017` and DB `sv-app`
- If using auth, mirror credentials in `.env` and update connection strings
- Consider a manual "Process batch" endpoint for dev: `POST /api/worker/tick?limit=10` to avoid always-on loops

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
