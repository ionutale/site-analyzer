<script lang="ts">
	import { resolve } from '$app/paths';
	import { toasts } from '$lib/stores/toast';
	let { data } = $props();
	const page = data.page;

	let busy = $state(false);
	let busyNow = $state(false);
	let busyAudit = $state(false);

	async function reprocess() {
		if (!page) return;
		try {
			busy = true;
			const res = await fetch('/api/reprocess', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ siteId: page.siteId, url: page.url })
			});
			if (!res.ok) throw new Error('Failed to queue reprocess');
			toasts.success('Reprocess queued. The worker will pick this up shortly.');
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Reprocess failed: ${msg}`);
		} finally {
			busy = false;
		}
	}

	async function processNow() {
		if (!page) return;
		try {
			busyNow = true;
			const res = await fetch('/api/process-one', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ siteId: page.siteId, url: page.url })
			});
			if (!res.ok) throw new Error('Failed to process now');
			toasts.success('Processing complete. Refresh to see latest data.');
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Process now failed: ${msg}`);
		} finally {
			busyNow = false;
		}
	}

	async function runAudit() {
		if (!page) return;
		try {
			busyAudit = true;
			const res = await fetch('/api/audit-performance', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ siteId: page.siteId, url: page.url })
			});
			if (!res.ok) throw new Error('Failed to run audit');
			const data = await res.json();
			toasts.success(`Audit complete. Score: ${Math.round(data.performance.score)}`);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Audit failed: ${msg}`);
		} finally {
			busyAudit = false;
		}
	}
</script>

<section class="mx-auto max-w-4xl space-y-4 p-4">
	<a href={resolve('/analyzer')} class="text-blue-600 hover:underline">← Back to Analyzer</a>

	{#if page}
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold">{page.title || page.url}</h1>
				<div class="text-sm opacity-70">{page.url}</div>
			</div>
			<div class="flex gap-2">
				<button class="btn btn-primary btn-sm" onclick={reprocess} disabled={busy}>Reprocess</button>
				<button class="btn btn-secondary btn-sm" onclick={processNow} disabled={busyNow}>Process now (dev)</button>
				<button class="btn btn-accent btn-sm" onclick={runAudit} disabled={busyAudit}>Run Performance Audit</button>
			</div>
		</div>

		{#if page.performance}
			<div class="alert alert-info shadow-lg">
				<div>
					<h3 class="font-bold">Performance Score: {Math.round(page.performance.score)}</h3>
					<div class="text-xs">Audited: {new Date(page.performance.auditedAt).toLocaleString()}</div>
				</div>
				<div class="flex gap-4 text-sm">
					<div>FCP: {Math.round(page.performance.fcp)}ms</div>
					<div>LCP: {Math.round(page.performance.lcp)}ms</div>
					<div>CLS: {page.performance.cls.toFixed(3)}</div>
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<div class="rounded bg-base-200 p-2">Status: <strong>{page.statusCode ?? 'n/a'}</strong></div>
			<div class="rounded bg-base-200 p-2">
				Fetched: <strong>{new Date(page.fetchedAt).toLocaleString()}</strong>
			</div>
			<div class="rounded bg-base-200 p-2">Type: <strong>{page.contentType ?? 'n/a'}</strong></div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="rounded bg-base-200 p-3">
				<h3 class="mb-2 text-lg font-medium">Links</h3>
				<div class="text-sm">
					<p><strong>Outgoing Links:</strong> {page.outgoingLinks?.length ?? 0}</p>
					<details class="mt-1">
						<summary class="cursor-pointer text-blue-600">Show Outgoing Links</summary>
						<ul class="ml-4 list-disc max-h-40 overflow-y-auto">
							{#each page.outgoingLinks || [] as link}
								<li class="truncate"><a href={link} target="_blank" rel="noopener" class="link">{link}</a></li>
							{/each}
						</ul>
					</details>
				</div>
				<div class="text-sm mt-4">
					<p><strong>Linked From (Backlinks):</strong> {page.linkedFrom?.length ?? 0}</p>
					{#if page.linkedFrom?.length}
						<ul class="ml-4 list-disc max-h-40 overflow-y-auto">
							{#each page.linkedFrom as backlink}
								<li class="truncate">
									<a href={backlink.url} target="_blank" rel="noopener" class="link">{backlink.title || backlink.url}</a>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-xs opacity-70">No internal pages link to this URL.</p>
					{/if}
				</div>
			</div>
			<div class="rounded bg-base-200 p-3">
				<h3 class="mb-2 text-lg font-medium">Accessibility</h3>
				<ul class="ml-5 list-disc">
					<li>Images missing alt: <strong>{page.a11y?.imagesMissingAlt ?? 0}</strong>
						{#if page.a11y?.imagesMissingAltUrls?.length}
							<ul class="ml-4 list-disc text-xs text-error">
								{#each page.a11y.imagesMissingAltUrls as url}
									<li class="truncate" title={url}>{url}</li>
								{/each}
							</ul>
						{/if}
					</li>
					<li>Anchors without text: <strong>{page.a11y?.anchorsWithoutText ?? 0}</strong></li>
					<li>H1 count: <strong>{page.a11y?.h1Count ?? 0}</strong></li>
				</ul>
			</div>
			<div class="rounded bg-base-200 p-3">
				<h3 class="mb-2 text-lg font-medium">SEO & Content</h3>
				<ul class="ml-5 list-disc">
					<li>Title length: <strong>{page.titleLength ?? 0}</strong> chars</li>
					<li>Meta description: <strong>{page.seo?.metaDescriptionLength ?? 0}</strong> chars
						{#if page.seo?.metaDescriptionIssues?.length}
							<span class="text-error text-xs">({page.seo.metaDescriptionIssues.join(', ')})</span>
						{/if}
					</li>
					<li>Word count: <strong>{page.wordCount ?? 0}</strong></li>
					<li>Structured Data: <strong>{page.seo?.structuredData ? 'Yes' : 'No'}</strong></li>
				</ul>
				<h4 class="mt-2 font-semibold">Heading Structure</h4>
				<div class="grid grid-cols-3 gap-1 text-sm">
					{#each Object.entries(page.seo?.hTags || {}) as [tag, count]}
						<div>{tag.toUpperCase()}: <strong>{count}</strong></div>
					{/each}
				</div>
				{#if page.seo?.structureIssues?.length}
					<div class="mt-2 text-error text-sm">
						<strong>Issues:</strong>
						<ul class="list-disc ml-4">
							{#each page.seo.structureIssues as issue}
								<li>{issue}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
			<div class="rounded bg-base-200 p-3">
				<h3 class="mb-2 text-lg font-medium">Images</h3>
				<p>Total images: <strong>{page.imagesMeta?.total ?? 0}</strong>; Large images: <strong>{page.imagesMeta?.largeDimensions ?? 0}</strong></p>
				<div class="overflow-x-auto">
					<table class="table mt-2">
						<thead><tr><th>Format</th><th>Count</th></tr></thead>
						<tbody>
							{#each Object.entries(page.imagesMeta?.counts || {}) as it (it[0])}
								<tr><td class="uppercase">{it[0]}</td><td>{it[1]}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if page.imagesMeta?.sampleLarge?.length}
					<h4 class="mt-2 font-semibold">Sample large images</h4>
					<ul class="ml-5 list-disc">
						{#each page.imagesMeta.sampleLarge as u (u)}
							<li class="truncate"><a class="link" href={u} target="_blank" rel="noopener">{u}</a></li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<h2 class="mt-4 text-lg font-medium">Excerpt</h2>
		<div class="prose max-w-none overflow-x-auto rounded bg-base-200 p-3">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html page.sanitizedExcerpt || ''}
		</div>

		{#if page.screenshotPath}
			<h3 class="text-lg font-medium">Screenshot</h3>
			<img src={page.screenshotPath} alt="screenshot" class="rounded border" />
		{/if}

		<details class="mt-3">
			<summary class="cursor-pointer text-blue-600">Show raw HTML</summary>
			<pre class="overflow-x-auto rounded bg-base-200 p-3 whitespace-pre-wrap">{page.content}</pre>
		</details>
	{:else}
		<p class="text-red-600">Failed to load page.</p>
	{/if}
</section>
