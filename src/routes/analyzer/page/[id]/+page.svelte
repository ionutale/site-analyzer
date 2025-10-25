<script lang="ts">
	let { data } = $props();
	const page = data.page;
</script>

<section class="mx-auto max-w-4xl space-y-4 p-4">
	<a href="/analyzer" class="text-blue-600 hover:underline">← Back to Analyzer</a>

	{#if page}
		<h1 class="text-2xl font-semibold">{page.title || page.url}</h1>
		<div class="text-sm opacity-70">{page.url}</div>

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<div class="rounded bg-base-200 p-2">Status: <strong>{page.statusCode ?? 'n/a'}</strong></div>
			<div class="rounded bg-base-200 p-2">
				Fetched: <strong>{new Date(page.fetchedAt).toLocaleString()}</strong>
			</div>
			<div class="rounded bg-base-200 p-2">Type: <strong>{page.contentType ?? 'n/a'}</strong></div>
		</div>

		<h2 class="mt-4 text-lg font-medium">Excerpt</h2>
		<div class="prose max-w-none overflow-x-auto rounded bg-base-200 p-3">
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
