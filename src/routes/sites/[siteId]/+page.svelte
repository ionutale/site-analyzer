<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { resolve } from '$app/paths';
	import { toasts } from '$lib/stores/toast';
	import StatusSummary from '$lib/components/molecules/StatusSummary.svelte';
	import LinksTable from '$lib/components/molecules/LinksTable.svelte';
	import PagesTable from '$lib/components/molecules/PagesTable.svelte';
	let { params } = $props();
	const siteId = params.siteId as string;

	let stats = $state<{
		pending: number;
		in_progress: number;
		done: number;
		error: number;
		total: number;
	} | null>(null);
	type LinkItem = {
		_id: string;
		url: string;
		status: string;
		attempts: number;
		updatedAt: string;
		pageId?: string | null;
	};
	type PageItem = {
		_id: string;
		url: string;
		title?: string | null;
		statusCode?: number | null;
		fetchedAt: string;
		contentType?: string | null;
	};
	let links = $state<LinkItem[]>([]);
	let pages = $state<PageItem[]>([]);
	let linksTotal = $state(0);
	let pagesTotal = $state(0);

	// filters
	let lq = $state('');
	let lstatus = $state('');
	let lpage = $state(1);
	let llimit = $state(20);
	let lsortBy = $state<'updatedAt' | 'url' | 'status' | 'attempts'>('updatedAt');
	let lsortDir = $state<'asc' | 'desc'>('desc');

	let pq = $state('');
	let ppage = $state(1);
	let plimit = $state(20);
	let psortBy = $state<'fetchedAt' | 'url' | 'title' | 'statusCode'>('fetchedAt');
	let psortDir = $state<'asc' | 'desc'>('desc');

	async function fetchStatus() {
		const res = await fetch(`/api/status?siteId=${encodeURIComponent(siteId)}`);
		if (res.ok) stats = await res.json();
	}
	async function fetchLinks() {
		const qp = new URLSearchParams({
			siteId,
			page: String(lpage),
			limit: String(llimit),
			sortBy: lsortBy,
			sortDir: lsortDir
		});
		if (lq.trim()) qp.set('q', lq.trim());
		if (lstatus) qp.set('status', lstatus);
		const res = await fetch(`/api/links?${qp}`);
		if (res.ok) {
			const data = await res.json();
			links = data.items;
			linksTotal = data.total;
		}
	}
	async function fetchPages() {
		const qp = new URLSearchParams({
			siteId,
			page: String(ppage),
			limit: String(plimit),
			sortBy: psortBy,
			sortDir: psortDir
		});
		if (pq.trim()) qp.set('q', pq.trim());
		const res = await fetch(`/api/pages?${qp}`);
		if (res.ok) {
			const data = await res.json();
			pages = data.items;
			pagesTotal = data.total;
		}
	}
	onMount(() => {
		fetchStatus();
		fetchLinks();
		fetchPages();
	});

	async function resetSite() {
		if (!dev) return;
		if (!confirm('Delete all data for this site?')) return;
		try {
			const res = await fetch(`/api/reset-site?siteId=${encodeURIComponent(siteId)}`, {
				method: 'POST'
			});
			if (!res.ok) throw new Error('Failed to reset site');
			toasts.success('Site data deleted successfully');
			await fetchStatus();
			await fetchLinks();
			await fetchPages();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			toasts.error(`Reset failed: ${msg}`);
		}
	}

	async function resume(mode: 'all' | 'retry-errors' = 'all') {
		try {
			const res = await fetch(
				`/api/resume?siteId=${encodeURIComponent(siteId)}&mode=${encodeURIComponent(mode)}`,
				{ method: 'POST' }
			);
			if (!res.ok) throw new Error('Failed to resume processing');
			const data = await res.json();
			toasts.success(
				`Resumed: requeued stale ${data.requeuedStale ?? 0}, retried errors ${
					data.retriedErrors ?? 0
				}`
			);
			await fetchStatus();
			await fetchLinks();
			await fetchPages();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			toasts.error(`Resume failed: ${msg}`);
		}
	}
</script>

<section class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Site: <code>{siteId}</code></h1>
		<div class="flex items-center gap-2">
			<a class="btn" href={resolve(`/sites/${siteId}/seo`)}>SEO</a>
			<div class="btn-group">
				<button class="btn" onclick={() => resume('all')}>Resume all</button>
				<button class="btn" onclick={() => resume('retry-errors')}>Retry errors</button>
			</div>
			{#if dev}
				<button class="btn btn-error" onclick={resetSite}>Reset site</button>
			{/if}
		</div>
	</div>

	{#if stats}
		<div class="card bg-base-200">
			<div class="card-body">
				<div class="flex flex-wrap items-center gap-4">
					<div>
						<div class="mb-1 text-sm opacity-70">Status distribution</div>
						<div class="flex h-24 items-end gap-2">
							{#each ['pending', 'in_progress', 'done', 'error'] as key (key)}
								{@const val = (stats?.[key as keyof typeof stats] as number) ?? 0}
								<div class="flex flex-col items-center gap-1">
									<div
										class="w-10 rounded-t bg-primary"
										style={`height:${Math.max(2, Math.round((val / Math.max(1, stats.total)) * 96))}px`}
									></div>
									<div class="text-xs">{key}</div>
								</div>
							{/each}
						</div>
					</div>
					<div class="divider lg:divider-horizontal"></div>
					<StatusSummary {stats} />
				</div>
			</div>
		</div>
	{/if}

	<div class="card bg-base-200">
		<div class="card-body gap-4">
			<div class="flex flex-wrap items-end gap-2">
				<div class="form-control w-full sm:w-48">
					<label class="label" for="ls"><span class="label-text">Status</span></label>
					<select
						id="ls"
						class="select-bordered select"
						bind:value={lstatus}
						onchange={() => {
							lpage = 1;
							fetchLinks();
						}}
					>
						<option value="">All</option>
						<option value="pending">Pending</option>
						<option value="in_progress">In progress</option>
						<option value="done">Done</option>
						<option value="error">Error</option>
					</select>
				</div>
				<div class="form-control w-full">
					<label class="label" for="lq"><span class="label-text">Search URL</span></label>
					<input
						id="lq"
						class="input-bordered input"
						placeholder="contains…"
						bind:value={lq}
						onkeydown={(e) => e.key === 'Enter' && ((lpage = 1), fetchLinks())}
					/>
				</div>
				<div class="form-control w-28">
					<label class="label" for="ll"><span class="label-text">Page size</span></label>
					<select
						id="ll"
						class="select-bordered select"
						bind:value={llimit}
						onchange={() => {
							lpage = 1;
							fetchLinks();
						}}
					>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
				</div>
				<div class="form-control w-40">
					<label class="label" for="lsb"><span class="label-text">Sort</span></label>
					<select
						id="lsb"
						class="select-bordered select"
						bind:value={lsortBy}
						onchange={() => {
							lpage = 1;
							fetchLinks();
						}}
					>
						<option value="updatedAt">Updated</option>
						<option value="url">URL</option>
						<option value="status">Status</option>
						<option value="attempts">Attempts</option>
					</select>
				</div>
				<div class="form-control w-32">
					<label class="label" for="lsd"><span class="label-text">Direction</span></label>
					<select
						id="lsd"
						class="select-bordered select"
						bind:value={lsortDir}
						onchange={() => {
							lpage = 1;
							fetchLinks();
						}}
					>
						<option value="desc">Desc</option>
						<option value="asc">Asc</option>
					</select>
				</div>
			</div>

			<LinksTable items={links} showSelection={false} />

			<div class="flex items-center justify-between">
				<button
					class="btn"
					onclick={() => {
						if (lpage > 1) {
							lpage -= 1;
							fetchLinks();
						}
					}}
					disabled={lpage <= 1}>Prev</button
				>
				<div class="text-sm">
					Page {lpage} of {Math.max(1, Math.ceil(linksTotal / llimit))} • {linksTotal} total
				</div>
				<button
					class="btn"
					onclick={() => {
						const max = Math.max(1, Math.ceil(linksTotal / llimit));
						if (lpage < max) {
							lpage += 1;
							fetchLinks();
						}
					}}
					disabled={lpage >= Math.max(1, Math.ceil(linksTotal / llimit))}>Next</button
				>
			</div>
		</div>
	</div>

	<div class="card bg-base-200">
		<div class="card-body gap-4">
			<div class="flex flex-wrap items-end gap-2">
				<div class="form-control w-full">
					<label class="label" for="pq"><span class="label-text">Search</span></label>
					<input
						id="pq"
						class="input-bordered input"
						placeholder="title/url contains…"
						bind:value={pq}
						onkeydown={(e) => e.key === 'Enter' && ((ppage = 1), fetchPages())}
					/>
				</div>
				<div class="form-control w-28">
					<label class="label" for="pl"><span class="label-text">Page size</span></label>
					<select
						id="pl"
						class="select-bordered select"
						bind:value={plimit}
						onchange={() => {
							ppage = 1;
							fetchPages();
						}}
					>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
				</div>
				<div class="form-control w-40">
					<label class="label" for="psb"><span class="label-text">Sort</span></label>
					<select
						id="psb"
						class="select-bordered select"
						bind:value={psortBy}
						onchange={() => {
							ppage = 1;
							fetchPages();
						}}
					>
						<option value="fetchedAt">Fetched</option>
						<option value="url">URL</option>
						<option value="title">Title</option>
						<option value="statusCode">Status</option>
					</select>
				</div>
				<div class="form-control w-32">
					<label class="label" for="psd"><span class="label-text">Direction</span></label>
					<select
						id="psd"
						class="select-bordered select"
						bind:value={psortDir}
						onchange={() => {
							ppage = 1;
							fetchPages();
						}}
					>
						<option value="desc">Desc</option>
						<option value="asc">Asc</option>
					</select>
				</div>
			</div>

			<PagesTable items={pages} />

			<div class="flex items-center justify-between">
				<button
					class="btn"
					onclick={() => {
						if (ppage > 1) {
							ppage -= 1;
							fetchPages();
						}
					}}
					disabled={ppage <= 1}>Prev</button
				>
				<div class="text-sm">
					Page {ppage} of {Math.max(1, Math.ceil(pagesTotal / plimit))} • {pagesTotal} total
				</div>
				<button
					class="btn"
					onclick={() => {
						const max = Math.max(1, Math.ceil(pagesTotal / plimit));
						if (ppage < max) {
							ppage += 1;
							fetchPages();
						}
					}}
					disabled={ppage >= Math.max(1, Math.ceil(pagesTotal / plimit))}>Next</button
				>
			</div>
		</div>
	</div>
</section>
