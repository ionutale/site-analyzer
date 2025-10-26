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

