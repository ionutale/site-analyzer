# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Docker Compose: MongoDB

Spin up a local MongoDB for development using the provided `docker-compose.yml`.

### Start/Stop

```sh
# start in the background
docker compose up -d

# view logs
docker compose logs -f mongodb

# stop and remove containers (volumes are preserved)
docker compose down

# remove containers and named volumes
docker compose down -v
```

### Troubleshooting

- Error: `Command update requires authentication`
  - Cause: Existing MongoDB volumes were created earlier with authentication enabled and persisted.
  - Fix options:
    - Easiest: reset volumes and start fresh
      ```sh
      docker compose down -v
      docker compose up -d
      ```
    - Non-destructive: we switched to new dev volumes (`mongo-data-dev`, `mongo-config-dev`) so `docker compose up -d` will start a fresh no-auth instance without touching older volumes.

### Connection (no-auth default)

- Default creds (dev only): username `root`, password `example`
- Local connection string (admin DB):

```
mongodb://root:example@localhost:27017/?authSource=admin
```

- If you create an app database (e.g. `app`):

```
mongodb://root:example@localhost:27017/app?authSource=admin
```

### Data and optional tools

### Auth mode (optional)

This repo includes an init script to create a non-root dev user `local-user` with password `1234567890` on DB `sv-app`.

To enable auth:

1. Ensure the compose file has these env vars (already configured):

```
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=admin
MONGO_INITDB_DATABASE=sv-app
```

2. Start fresh so the init scripts run (first-run only):

```sh
docker compose down -v
docker compose up -d
```

3. Use this connection string:

```
mongodb://local-user:1234567890@localhost:27017/sv-app?authSource=sv-app
```

If you prefer a different password or database, edit `docker/mongo-init/01-create-local-user.js` and restart with `down -v`.

- Data persists in named volumes: `mongo-data` and `mongo-config`.
- To auto-seed on first run, place `.js` or `.sh` files in `./docker/mongo-init` and
  uncomment the corresponding volume line in `docker-compose.yml`.
- Optional web UI: uncomment the `mongo-express` service in `docker-compose.yml` and open
  http://localhost:8081.

## App overview

This project is a site analyzer built with SvelteKit + Tailwind (DaisyUI) and MongoDB. It:

- Ingests links from a site's sitemap
- Processes pages with a Playwright-based worker (fetches HTML, extracts text/SEO metrics)
- Surfaces dashboards and tools:
  - Analyzer: view/crawl status, filter, batch retry/purge, resume stuck jobs
  - Sites: list sites and per-site dashboards (sortable headers, client-side pagination)
  - SEO: missing/duplicate titles/meta/canonical, slow pages, duplicate content by text hash
  - Home: high-level cards and recent sites

Main routes:

- `/` Home dashboard
- `/analyzer` Analyzer dashboard
- `/sites` Sites list
- `/sites/[siteId]` Site dashboard
- `/sites/[siteId]/seo` SEO dashboard
- `/analyzer/page/[id]` Page details

### What’s new

- Analyzer UX: persistent status summary during refresh with dimming and inline spinner on the "In progress" tile; toasts for actions
- Sites list: new `SitesTable` with sortable headers and client-side pagination, also used on Home’s recent sites
- Order alignment: ingest stamps per-URL timestamps and the worker leases newest-first so processing matches UI ordering
- Worker prefers `CONCURRENT_WORKERS` (legacy `WORKER_CONCURRENCY` supported) and logs chosen startup config

## Environment variables

Copy `.env.example` to `.env` and adjust as needed. Keys used by the app/worker:

- Mongo
  - `MONGODB_URI` (e.g. `mongodb://local-user:1234567890@localhost:27017/sv-app?authSource=sv-app`)
  - `MONGODB_DB` (e.g. `sv-app`)
- Worker/Playwright
  - `PLAYWRIGHT_HEADLESS` (default `true`)
  - `CONCURRENT_WORKERS` (default `3`) — preferred
  - `WORKER_CONCURRENCY` — legacy alias, still supported
  - `WORKER_MAX_ATTEMPTS` (default `3`)
  - `LEASE_TIMEOUT_MS` (default `900000` = 15m)
  - Optional screenshots:
    - `PLAYWRIGHT_SCREENSHOTS` (`true`/`false`, default `false`)
    - `SCREENSHOTS_DIR` (default `static/screenshots`)
- Dev protection (optional)
  - `DEV_API_TOKEN` — if set, you must send `x-dev-token: <value>` for dev-only endpoints
- Server-side rate limiting (optional)
  - `RATE_LIMIT_WINDOW_MS` — time window in ms (enable by setting both WINDOW and TOKENS)
  - `RATE_LIMIT_TOKENS` — tokens per window
  - `RATE_LIMIT_BURST` — optional extra capacity (defaults to TOKENS when omitted)

## Running the app and worker

1. Install deps and start the dev server:

```sh
pnpm install
pnpm dev
```

2. In a second terminal, run the Playwright worker (processes leased links):

```sh
pnpm worker
```

3. In the UI, open `/analyzer`, enter a site URL, and ingest. Use Resume/Batch actions as needed.

Notes:

- The app expects MongoDB to be running. See the Docker Compose section above for local setup.
- The worker will compute text-only content and SEO metrics, and optionally write screenshots when enabled.
- On startup, the worker logs the chosen configuration (concurrency, headless mode, max attempts, lease timeout, screenshots flag).

## Dev endpoints and protections

Some helper endpoints are dev-only and should not be exposed in production without safeguards:

- `POST /api/process-batch` — process a small batch without running the worker loop
- `POST /api/reset-site?siteId=...` — purge a site's data (links + pages)
- `POST /api/links/batch` — retry or purge selected links by ID
- `POST /api/resume?siteId=...` — requeue stale `in_progress` and retry `error` under max attempts

Protections:

- In production (`NODE_ENV=production`), some endpoints return 403 by default
- If `DEV_API_TOKEN` is set, requests must include header `x-dev-token: <token>`
- Optional rate limiting (see below)

## Server-side rate limiting (optional)

An in-memory token bucket protects selected endpoints. It’s disabled unless both
`RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_TOKENS` are provided. Behavior:

- Per-IP, per-key buckets
- Refills `TOKENS` per `WINDOW_MS`, with optional `RATE_LIMIT_BURST` capacity
- On exceed, returns HTTP 429 with JSON `{ "error": "rate_limited" }` and `Retry-After`

Environment example:

```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_TOKENS=60
RATE_LIMIT_BURST=100
```

## Screenshots (optional)

Enable screenshots during processing by setting:

```
PLAYWRIGHT_SCREENSHOTS=true
# optionally override directory
# SCREENSHOTS_DIR=static/screenshots
```

Images will be written under `static/screenshots` (or your configured directory).

## Testing

- Unit: `pnpm test:unit`
- E2E: `pnpm test:e2e`
