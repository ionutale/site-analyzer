<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { resolve } from '$app/paths';
	import { toasts } from '$lib/stores/toast';

	let siteUrl = $state('');
	let siteId = $state<string | null>(null);
	let loading = $state(false);
	let sites = $state<Array<{ siteId: string }>>([]);

	let stats = $state<{
		pending: number;
		in_progress: number;
		done: number;
		error: number;
		total: number;
	} | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;

	// links table state
	type LinkItem = {
		_id: string;
		url: string;
		status: string;
		attempts: number;
		lastError?: string;
		updatedAt: string;
		pageId?: string | null;
	};
	let items = $state<LinkItem[]>([]);
	let total = $state(0);
	let page = $state(1);
	let limit = $state(20);
	let statusFilter = $state<string>('');
	let q = $state('');
	let healthOk = $state<boolean | null>(null);
	let sortBy = $state<'updatedAt' | 'url' | 'status' | 'attempts'>('updatedAt');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let onlyErrors = $state(false);
	let selected = $state<Set<string>>(new SvelteSet());
	// use toasts for resume feedback

	async function ingest() {
		loading = true;
		try {
			const res = await fetch('/api/ingest', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ siteUrl })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Failed to ingest sitemap');
			siteId = data.siteId;
			try {
				if (siteId) localStorage.setItem('lastSiteId', siteId);
			} catch {
				// Ignore localStorage errors
			}
			toasts.success(`Sitemap ingested: ${data.inserted || 0} URLs added`);
			// reset filters
			page = 1;
			// start polling
			startPolling();
			await fetchLinks();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			toasts.error(`Ingest failed: ${msg}`);
		} finally {
			loading = false;
		}
	}

	async function fetchStatus() {
		if (!siteId) return;
		const res = await fetch(`/api/status?siteId=${encodeURIComponent(siteId)}`);
		if (res.ok) {
			const data = await res.json();
			stats = {
				pending: data.pending,
				in_progress: data.in_progress,
				done: data.done,
				error: data.error,
				total: data.total
			};
		}
	}

	async function fetchLinks() {
		if (!siteId) return;
		const params = new SvelteURLSearchParams({
			siteId,
			page: String(page),
			limit: String(limit),
			sortBy,
			sortDir
		});
		if (statusFilter) params.set('status', statusFilter);
		if (q.trim()) params.set('q', q.trim());
		const res = await fetch(`/api/links?${params.toString()}`);
		if (res.ok) {
			const data = await res.json();
			items = data.items;
			total = data.total;
			// clear selection for items no longer visible
			const visibleIds = new SvelteSet(items.map((i) => i._id));
			selected = new SvelteSet([...selected].filter((id) => visibleIds.has(id)));
		}
	}

	function startPolling() {
		if (timer) clearInterval(timer);
		fetchStatus();
		fetchLinks();
		timer = setInterval(async () => {
			await fetchStatus();
			await fetchLinks();
		}, 5000);
	}

	async function checkHealth() {
		const res = await fetch('/api/health');
		healthOk = res.ok;
	}

	async function processBatch() {
		if (!siteId) return;
		const res = await fetch(`/api/process-batch?siteId=${encodeURIComponent(siteId)}&count=3`, {
			method: 'POST'
		});
		if (res.ok) {
			await fetchStatus();
			await fetchLinks();
		}
	}

	async function resetSite() {
		if (!siteId) return;
		if (!confirm('Delete all data for this site?')) return;
		try {
			const res = await fetch(`/api/reset-site?siteId=${encodeURIComponent(siteId)}`, {
				method: 'POST'
			});
			if (!res.ok) throw new Error('Failed to reset site');
			toasts.success('Site data deleted successfully');
			await fetchStatus();
			await fetchLinks();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			toasts.error(`Reset failed: ${msg}`);
		}
	}

	async function batchAction(action: 'retry' | 'purge') {
		if (!siteId || selected.size === 0) return;
		try {
			const res = await fetch('/api/links/batch', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ siteId, ids: Array.from(selected), action })
			});
			if (!res.ok) throw new Error('Batch action failed');
			const actionText = action === 'retry' ? 'retried' : 'purged';
			toasts.success(`${selected.size} link(s) ${actionText} successfully`);
			selected.clear();
			await fetchStatus();
			await fetchLinks();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			toasts.error(`Batch action failed: ${msg}`);
		}
	}

	async function resume(mode: 'all' | 'retry-errors' = 'all') {
		if (!siteId) return;
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
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Unknown error';
			toasts.error(`Resume failed: ${msg}`);
		}
	}

	onMount(() => () => timer && clearInterval(timer));

	async function loadSites() {
		try {
			const res = await fetch('/api/sites');
			if (res.ok) {
				const data = (await res.json()) as Array<{ siteId: string }>;
				sites = data;
			}
		} catch {
			// Ignore API errors for sites list
		}
	}

	onMount(() => {
		loadSites();
		try {
			const qp = new URLSearchParams(location.search);
			const qSite = qp.get('siteId');
			const stored = localStorage.getItem('lastSiteId');
			if (!siteId && (qSite || stored)) {
				siteId = qSite || stored;
				startPolling();
			}
		} catch {
			// Ignore localStorage errors
		}
		return () => timer && clearInterval(timer);
	});
</script>

<section class="space-y-6">
	<h1 class="text-3xl font-bold">Site Analyzer</h1>

	<form
		class="flex flex-col gap-2 sm:flex-row"
		onsubmit={(e) => {
			e.preventDefault();
			ingest();
		}}
	>
		<input
			type="url"
			required
			placeholder="https://example.com"
			bind:value={siteUrl}
			class="input-bordered input w-full"
		/>
		<button class="btn btn-primary" disabled={loading}>
			{loading ? 'Ingesting…' : 'Ingest sitemap'}
		</button>
		<button class="btn btn-ghost" type="button" onclick={checkHealth} title="DB health"
			>Health</button
		>
		{#if healthOk !== null}
			<span class="badge {healthOk ? 'badge-success' : 'badge-error'}"
				>{healthOk ? 'DB OK' : 'DB Issue'}</span
			>
		{/if}
	</form>

	<div class="flex items-center gap-2">
		<div class="form-control w-full sm:w-64">
			<label class="label" for="siteSel"><span class="label-text">Select site</span></label>
			<select
				id="siteSel"
				class="select-bordered select"
				bind:value={siteId}
				onchange={() => {
					try {
						if (siteId) localStorage.setItem('lastSiteId', siteId);
					} catch {
						// Ignore localStorage errors
					}
					page = 1;
					startPolling();
				}}
			>
				<option value={null}>—</option>
				{#each sites as s (s.siteId)}
					<option value={s.siteId}>{s.siteId}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if siteId}
		<div class="card bg-base-200">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<h2 class="card-title">Status</h2>
					<div class="btn-group">
						<button class="btn" type="button" onclick={() => resume('all')}>Resume all</button>
						<button class="btn" type="button" onclick={() => resume('retry-errors')}
							>Retry errors</button
						>
					</div>
					<code class="text-xs opacity-70">siteId: {siteId}</code>
				</div>
				{#if stats}
					<ul class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
						<li class="stat rounded-box bg-base-100">
							<div class="stat-title">Pending</div>
							<div class="stat-value text-lg">{stats.pending}</div>
						</li>
						<li class="stat rounded-box bg-base-100">
							<div class="stat-title">In progress</div>
							<div class="stat-value text-lg">{stats.in_progress}</div>
						</li>
						<li class="stat rounded-box bg-base-100">
							<div class="stat-title">Done</div>
							<div class="stat-value text-lg">{stats.done}</div>
						</li>
						<li class="stat rounded-box bg-base-100">
							<div class="stat-title">Error</div>
							<div class="stat-value text-lg">{stats.error}</div>
						</li>
						<li class="stat rounded-box bg-base-100">
							<div class="stat-title">Total</div>
							<div class="stat-value text-lg">{stats.total}</div>
						</li>
					</ul>
				{:else}
					<p class="mt-2 text-sm opacity-70">Waiting for first status update…</p>
				{/if}
			</div>
		</div>

		<div class="card bg-base-200">
			<div class="card-body gap-4">
				<div class="flex flex-col items-end gap-2 sm:flex-row">
					<div class="form-control w-full sm:w-48">
						<label class="label" for="statusFilter"><span class="label-text">Status</span></label>
						<select
							id="statusFilter"
							class="select-bordered select"
							bind:value={statusFilter}
							onchange={() => {
								page = 1;
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
						<label class="label" for="searchUrl"><span class="label-text">Search URL</span></label>
						<input
							id="searchUrl"
							class="input-bordered input"
							placeholder="contains…"
							bind:value={q}
							onkeydown={(e) => e.key === 'Enter' && ((page = 1), fetchLinks())}
						/>
					</div>
					<div class="form-control w-40">
						<label class="label" for="sortBy"><span class="label-text">Sort</span></label>
						<select
							id="sortBy"
							class="select-bordered select"
							bind:value={sortBy}
							onchange={() => {
								page = 1;
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
						<label class="label" for="sortDir"><span class="label-text">Direction</span></label>
						<select
							id="sortDir"
							class="select-bordered select"
							bind:value={sortDir}
							onchange={() => {
								page = 1;
								fetchLinks();
							}}
						>
							<option value="desc">Desc</option>
							<option value="asc">Asc</option>
						</select>
					</div>
					<div class="form-control w-28">
						<label class="label" for="pageSize"><span class="label-text">Page size</span></label>
						<select
							id="pageSize"
							class="select-bordered select"
							bind:value={limit}
							onchange={() => {
								page = 1;
								fetchLinks();
							}}
						>
							<option value={10}>10</option>
							<option value={20}>20</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
					</div>
					<div class="flex-1"></div>
					{#if dev}
						<button class="btn btn-secondary" type="button" onclick={processBatch}
							>Process batch</button
						>
					{/if}
					<button
						class="btn"
						type="button"
						onclick={() => {
							onlyErrors = !onlyErrors;
							statusFilter = onlyErrors ? 'error' : '';
							page = 1;
							fetchLinks();
						}}
					>
						{onlyErrors ? 'Showing: errors' : 'Only errors'}
					</button>
				</div>

				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th
									><input
										type="checkbox"
										checked={items.length > 0 && selected.size === items.length}
										indeterminate={selected.size > 0 && selected.size < items.length}
										onchange={(e) => {
											const c = (e.target as HTMLInputElement).checked;
											selected = new SvelteSet(c ? items.map((i) => i._id) : []);
										}}
									/></th
								>
								<th>URL</th>
								<th>Status</th>
								<th>Attempts</th>
								<th>Updated</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each items as it (it._id)}
								<tr>
									<td
										><input
											type="checkbox"
											checked={selected.has(it._id)}
											onchange={(e) => {
												const c = (e.target as HTMLInputElement).checked;
												if (c) selected.add(it._id);
												else selected.delete(it._id);
												selected = new SvelteSet(selected);
											}}
										/></td
									>
									<td class="max-w-[420px] truncate">
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a>
									</td>
									<td>
										<span
											class="badge {it.status === 'done'
												? 'badge-success'
												: it.status === 'error'
													? 'badge-error'
													: it.status === 'in_progress'
														? 'badge-warning'
														: ''}">{it.status}</span
										>
									</td>
									<td>{it.attempts}</td>
									<td>{new Date(it.updatedAt).toLocaleString()}</td>
									<td>
										{#if it.pageId}
											<a class="btn btn-sm" href={resolve(`/analyzer/page/${it.pageId}`)}>View</a>
										{:else}
											<span class="text-sm opacity-50">n/a</span>
										{/if}
									</td>
								</tr>
							{/each}
							{#if items.length === 0}
								<tr><td colspan="5" class="text-center opacity-70">No items</td></tr>
							{/if}
						</tbody>
					</table>
				</div>

				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<button
							class="btn btn-outline"
							disabled={selected.size === 0}
							onclick={() => batchAction('retry')}>Retry selected</button
						>
						<button
							class="btn btn-outline btn-error"
							disabled={selected.size === 0}
							onclick={() => batchAction('purge')}>Purge selected</button
						>
						<span class="text-sm opacity-70">{selected.size} selected</span>
					</div>
					<button
						class="btn"
						onclick={() => {
							if (page > 1) {
								page -= 1;
								fetchLinks();
							}
						}}
						disabled={page <= 1}>Prev</button
					>
					<div class="text-sm">
						Page {page} of {Math.max(1, Math.ceil(total / limit))} • {total} total
					</div>
					<div class="flex items-center gap-2">
						<button class="btn btn-error" onclick={resetSite} title="Dev only">Reset site</button>
						<button
							class="btn"
							onclick={() => {
								const max = Math.max(1, Math.ceil(total / limit));
								if (page < max) {
									page += 1;
									fetchLinks();
								}
							}}
							disabled={page >= Math.max(1, Math.ceil(total / limit))}>Next</button
						>
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>
