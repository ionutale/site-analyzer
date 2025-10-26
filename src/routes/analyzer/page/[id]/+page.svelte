<script lang="ts">
	import { resolve } from '$app/paths';
	import { toasts } from '$lib/stores/toast';
	let { data } = $props();
	const page = data.page;

	let busy = $state(false);
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
</script>

<section class="mx-auto max-w-4xl space-y-4 p-4">
	<a href={resolve('/analyzer')} class="text-blue-600 hover:underline">← Back to Analyzer</a>

	{#if page}
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold">{page.title || page.url}</h1>
				<div class="text-sm opacity-70">{page.url}</div>
			</div>
			<button class="btn btn-primary btn-sm" onclick={reprocess} disabled={busy}>Reprocess</button>
		</div>

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<div class="rounded bg-base-200 p-2">Status: <strong>{page.statusCode ?? 'n/a'}</strong></div>
			<div class="rounded bg-base-200 p-2">
				Fetched: <strong>{new Date(page.fetchedAt).toLocaleString()}</strong>
			</div>
			<div class="rounded bg-base-200 p-2">Type: <strong>{page.contentType ?? 'n/a'}</strong></div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="rounded bg-base-200 p-3">
				<h3 class="mb-2 text-lg font-medium">Accessibility</h3>
				<ul class="ml-5 list-disc">
					<li>Images missing alt: <strong>{page.a11y?.imagesMissingAlt ?? 0}</strong></li>
					<li>Anchors without text: <strong>{page.a11y?.anchorsWithoutText ?? 0}</strong></li>
					<li>H1 count: <strong>{page.a11y?.h1Count ?? 0}</strong></li>
				</ul>
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
