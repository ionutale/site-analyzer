<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { toasts } from '$lib/stores/toast';
	import StatusSummary from '$lib/components/molecules/StatusSummary.svelte';
	import LinksTable from '$lib/components/molecules/LinksTable.svelte';
	import PaginationControls from '$lib/components/molecules/PaginationControls.svelte';

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
	let statusLoading = $state(false);
	let statusError = $state<string | null>(null);
	let lastStatusAt = $state<Date | null>(null);
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
	let selected = $state<Set<string>>(new Set());
	let linksLoading = $state(false);
	let linksError = $state<string | null>(null);
	let lastLinksAt = $state<Date | null>(null);
	let resumeLoading = $state(false);
	let batchLoading = $state(false);
	// dev processing controls
	let devCount = $state(3);
	let draining = $state(false);
	// in-progress table state
	let ingestingItems = $state<LinkItem[]>([]);
	let ingestingLoading = $state(false);
	let ingestingError = $state<string | null>(null);
	let ingestingLimit = 100;
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
		statusError = null;
		if (!siteId) return;
		statusLoading = true;
		try {
			const res = await fetch(`/api/status?siteId=${encodeURIComponent(siteId)}`);
			if (!res.ok) throw new Error('Failed to refresh status');
			const data = await res.json();
			stats = {
				pending: data.pending,
				in_progress: data.in_progress,
				done: data.done,
				error: data.error,
				total: data.total
			};
			lastStatusAt = new Date();
		} catch (e: unknown) {
			statusError = e instanceof Error ? e.message : 'Unknown status error';
		} finally {
			statusLoading = false;
		}
	}

	async function fetchLinks() {
		if (!siteId) return;
		const params = new URLSearchParams({
			siteId,
			page: String(page),
			limit: String(limit),
			sortBy,
			sortDir
		});
		if (statusFilter) params.set('status', statusFilter);
		if (q.trim()) params.set('q', q.trim());
		linksError = null;
		linksLoading = true;
		try {
			const res = await fetch(`/api/links?${params.toString()}`);
			if (!res.ok) throw new Error('Failed to load links');
			const data = await res.json();
			items = data.items;
			total = data.total;
			lastLinksAt = new Date();
			// clear selection for items no longer visible
			const visibleIds = new Set(items.map((i) => i._id));
			selected = new Set([...selected].filter((id) => visibleIds.has(id)));
		} catch (e: unknown) {
			linksError = e instanceof Error ? e.message : 'Unknown links error';
		} finally {
			linksLoading = false;
		}
	}

	function startPolling() {
		if (timer) clearInterval(timer);
		fetchStatus();
		fetchLinks();
		fetchInProgressLinks();
		timer = setInterval(async () => {
			await fetchStatus();
			await fetchLinks();
			await fetchInProgressLinks();
		}, 5000);
	}

	async function fetchInProgressLinks() {
		if (!siteId) return;
		ingestingError = null;
		ingestingLoading = true;
		try {
			const params = new URLSearchParams({
				siteId,
				status: 'in_progress',
				page: '1',
				limit: String(ingestingLimit),
				sortBy: 'updatedAt',
				sortDir: 'desc'
			});
			const res = await fetch(`/api/links?${params.toString()}`);
			if (!res.ok) throw new Error('Failed to load in-progress links');
			const data = await res.json();
			ingestingItems = data.items;
		} catch (e: unknown) {
			ingestingError = e instanceof Error ? e.message : 'Unknown in-progress error';
		} finally {
			ingestingLoading = false;
		}
	}

	async function checkHealth() {
		const res = await fetch('/api/health');
		healthOk = res.ok;
		if (healthOk) toasts.success('DB health: OK');
		else toasts.error('DB health: Issue detected');
	}

	async function processBatch() {
		if (!siteId) return;
		const res = await fetch(
			`/api/process-batch?siteId=${encodeURIComponent(siteId)}&count=${encodeURIComponent(String(devCount))}`,
			{ method: 'POST' }
		);
		if (res.ok) {
			toasts.info('Triggered small batch processing');
			await fetchStatus();
			await fetchLinks();
		} else {
			toasts.error('Failed to process batch');
		}
	}

	async function drainQueue() {
		if (!siteId) return;
		try {
			draining = true;
			const res = await fetch(
				`/api/process-batch?siteId=${encodeURIComponent(siteId)}&count=${encodeURIComponent(String(devCount))}&drain=true`,
				{ method: 'POST' }
			);
			if (!res.ok) throw new Error('Drain request failed');
			const data = await res.json();
			toasts.success(`Drained: processed ${data.processedCount || 0} link(s)`);
			await fetchStatus();
			await fetchLinks();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Drain failed: ${msg}`);
		} finally {
			draining = false;
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
			batchLoading = true;
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
		} finally {
			batchLoading = false;
		}
	}

	async function resume(mode: 'all' | 'retry-errors' = 'all') {
		if (!siteId) return;
		try {
			resumeLoading = true;
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
		} finally {
			resumeLoading = false;
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
						if (siteId) toasts.info(`Switched to site: ${siteId}`);
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
		<!-- In-progress table -->
		{#if ingestingItems.length > 0 || ingestingLoading}
			<div class="card bg-base-200">
				<div class="card-body gap-4">
					<div class="flex items-center justify-between">
						<h2 class="card-title">Currently ingesting</h2>
						<div class="text-sm opacity-70 flex items-center gap-2">
							{#if ingestingLoading}
								<span class="loading loading-spinner loading-xs"></span>
								<span>Refreshing…</span>
							{:else}
								<span>{ingestingItems.length} in progress</span>
							{/if}
						</div>
					</div>
					{#if ingestingLoading}
						<div class="h-24 w-full skeleton"></div>
					{:else}
						<LinksTable items={ingestingItems} selected={new Set()} />
					{/if}
					{#if ingestingError}
						<div class="alert alert-error"><span>{ingestingError}</span></div>
					{/if}
				</div>
			</div>
		{/if}

		<div class="card bg-base-200">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<h2 class="card-title">Status</h2>
					<div class="btn-group">
						<button class="btn" type="button" disabled={resumeLoading} onclick={() => resume('all')}>
							{resumeLoading ? 'Resuming…' : 'Resume all'}
						</button>
						<button class="btn" type="button" disabled={resumeLoading} onclick={() => resume('retry-errors')}
							>Retry errors</button
						>
					</div>
					<code class="text-xs opacity-70">siteId: {siteId}</code>
				</div>
				{#if !stats}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
						<div class="stat rounded-box bg-base-100"><div class="h-5 w-20 skeleton"></div><div class="h-6 w-12 skeleton"></div></div>
						<div class="stat rounded-box bg-base-100"><div class="h-5 w-20 skeleton"></div><div class="h-6 w-12 skeleton"></div></div>
						<div class="stat rounded-box bg-base-100"><div class="h-5 w-20 skeleton"></div><div class="h-6 w-12 skeleton"></div></div>
						<div class="stat rounded-box bg-base-100"><div class="h-5 w-20 skeleton"></div><div class="h-6 w-12 skeleton"></div></div>
						<div class="stat rounded-box bg-base-100"><div class="h-5 w-20 skeleton"></div><div class="h-6 w-12 skeleton"></div></div>
					</div>
				{:else}
					<div class={statusLoading ? 'opacity-70 transition-opacity' : ''}>
						<StatusSummary {stats} loading={statusLoading} />
					</div>
				{/if}
				<div class="mt-2 flex items-center gap-2 text-xs opacity-70">
					{#if statusError}
						<span class="badge badge-error">{statusError}</span>
					{:else}
						{#if statusLoading}
							<span class="loading loading-spinner loading-xs"></span>
							<span>Refreshing…</span>
						{:else if lastStatusAt}
						<span>Last updated: {lastStatusAt.toLocaleTimeString()}</span>
						{/if}
					{/if}
				</div>
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
							<option value="fetching">Fetching</option>
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
						<div class="flex items-end gap-2">
							<div class="form-control w-28">
								<label class="label" for="devCount"><span class="label-text">Concurrency</span></label>
								<select id="devCount" class="select-bordered select" bind:value={devCount}>
									<option value={1}>1</option>
									<option value={2}>2</option>
									<option value={3}>3</option>
									<option value={4}>4</option>
									<option value={5}>5</option>
									<option value={6}>6</option>
									<option value={8}>8</option>
									<option value={10}>10</option>
								</select>
							</div>
							<button class="btn btn-secondary" type="button" onclick={processBatch}
								>Process batch</button
							>
							<button class="btn" type="button" disabled={draining} onclick={drainQueue}>
								{draining ? 'Draining…' : 'Drain queue'}
							</button>
						</div>
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

				{#if linksLoading}
					<div class="h-32 w-full skeleton"></div>
				{:else}
					<LinksTable {items} {selected} on:selectionChange={(e) => (selected = e.detail)} />
				{/if}
				{#if linksError}
					<div class="alert alert-error"><span>{linksError}</span></div>
				{/if}

				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<button
							class="btn btn-outline"
							disabled={selected.size === 0 || batchLoading}
							onclick={() => batchAction('retry')}>Retry selected</button
						>
						<button
							class="btn btn-outline btn-error"
							disabled={selected.size === 0 || batchLoading}
							onclick={() => batchAction('purge')}>Purge selected</button
						>
						<span class="text-sm opacity-70">{selected.size} selected{batchLoading ? ' • Working…' : ''}</span>
						<button class="btn btn-error" onclick={resetSite} title="Dev only">Reset site</button>
					</div>
					<PaginationControls
						{page}
						max={Math.max(1, Math.ceil(total / limit))}
						{total}
						on:change={(e) => {
							page = e.detail;
							fetchLinks();
						}}
					/>
				</div>
			</div>
		</div>
	{/if}
</section>
