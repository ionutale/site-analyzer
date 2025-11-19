# New features and suggestions (from chat history)

This document aggregates implemented items and proposed follow-ups captured during the session.

## Implemented/updated

- Analyzer UX improvements
	- Persistent StatusSummary: stays visible during refresh with dimming and a spinner on the "In progress" tile
	- Toast notifications for ingest, health, batch actions, reset, resume, site switch
	- New "Currently ingesting" table showing only `in_progress` links; rows disappear as they finish
	- Links table: status filter, search, sort, page size, pagination controls; "Only errors" toggle

- Sites list and home
	- SitesTable with sortable headers and client-side pagination; empty-state CTA
	- Home dashboard with cards and recent sites; quick links to Analyzer/Site/SEO pages

- Ordering and processing alignment
	- Ingest assigns per-URL `createdAt`/`updatedAt` to preserve sitemap/UI order (default sort: updatedAt desc)
	- Worker leases newest-first `{ createdAt: -1, updatedAt: -1, _id: -1 }` so processing matches rendered order

	- Worker and dev endpoint
	- Concurrency driven by `CONCURRENT_WORKERS` (prefers this over legacy `WORKER_CONCURRENCY`)
	- Worker startup log prints headless, concurrency, attempts, lease timeout, screenshots dir
	- Dev endpoint `/api/process-batch` now leases up to `count` and processes concurrently using one browser

- SEO and content
	- Duplicate content detection via normalized text hash (`contentHash`) and SEO API surfacing groups
	- Worker computes title length, word count, canonical URL, text-only content, and optional screenshots

- Navigation and layout
	- Drawer-only navigation on all devices; header links removed
	- Drawer docked open on desktop (xl:drawer-open)
	- Header simplified (no profile button or theme toggle); controls live in the drawer
	- Drawer shows user info; close-on-click for mobile

- Authentication
	- Firebase Auth (Google) wired with a user store and session persistence
	- Login page with redirect handling; Profile page with sign-out
	- Plan updated to guard all app pages (except landing/login) behind auth

- Documentation
	- README: added What’s new; noted SitesTable sorting/paging and worker startup logs
	- Development plan: updated lease order, ingest timestamps, auth/mobile, drawer behavior
	- CHANGELOG: added "2025-10-26 — Docs: updates"

## Proposed/next

- Ingest behavior: set `updatedAt` only on insert to avoid reordering on re-ingest
- Sites list: move sorting to parent before pagination when combining sort + slice
- Micro progress indicator above StatusSummary during auto-refresh
- Drawer behavior: allow configuring docked breakpoint (e.g., lg) and adjustable width
- Dev endpoint: consider raising concurrency cap above 5 and/or exposing a `concurrency` param
- Gate privileged Analyzer actions behind auth in UI (retry/purge/reset), with inline prompts
- Add route guarding for all pages except landing/login using SvelteKit handle/layout
- Optional: overview endpoint for home aggregates to reduce client-side work

## Essential Features for Success

- **Export & Reporting System**: Generate professional PDF/CSV reports of audit results for stakeholders, including executive summaries and detailed issue lists.
- **Automated/Scheduled Monitoring**: Configure daily, weekly, or monthly automatic re-scans to track site health and SEO improvements over time.
- **Performance & Core Web Vitals**: Integrate Lighthouse or similar tools to measure FCP, LCP, CLS, and Speed Index alongside standard SEO metrics.
- **Advanced Content Analysis**: Expand checks to include H-tag hierarchy validation, missing alt text detection, meta description analysis, and structured data validation.
- **Link Source & Graph Visualization**: Provide a visual site tree to understand architecture and a detailed "Linked From" report to easily locate and fix broken links.

## Implemented Essential Features

- **Export & Reporting System**
	- Added `/api/export` endpoint for CSV export of site audits.
	- Added "Export CSV" button to Site Dashboard.

- **Automated/Scheduled Monitoring**
	- Added `sites` collection to store schedule configuration.
	- Implemented scheduler in `worker.ts` to check for due sites every minute.
	- Added UI controls in Site Dashboard to set schedule (Manual, Daily, Weekly, Monthly).

- **Performance & Core Web Vitals**
	- Integrated `lighthouse` for on-demand performance audits.
	- Added "Run Performance Audit" button to Page Details.
	- Displays FCP, LCP, CLS, and Speed Index scores.

- **Advanced Content Analysis**
	- Expanded worker to analyze H-tag structure (missing H1, skipped levels).
	- Added checks for Meta Description length and issues.
	- Added detection of Structured Data (JSON-LD).
	- Updated Page Details UI to show these new metrics.

- **Link Source & Graph Visualization**
	- Worker now extracts all outgoing links.
	- Page Details UI shows "Outgoing Links" list.
	- Page Details UI shows "Linked From (Backlinks)" list (reverse lookup of internal links).

