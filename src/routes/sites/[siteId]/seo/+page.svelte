<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { toasts } from '$lib/stores/toast';
	let { params } = $props();
	const siteId = params.siteId as string;
	let slowMs = $state(3000);
	type SeoSampleIdUrl = { _id: string; url: string };
	type SeoSamples = {
		slowPages: Array<{ _id: string; url: string; title?: string | null; loadTimeMs: number }>;
		missingTitlePages: SeoSampleIdUrl[];
		missingMetaPages: SeoSampleIdUrl[];
		non200Pages: Array<{ _id: string; url: string; statusCode?: number | null }>;
		missingCanonicalPages: SeoSampleIdUrl[];
		shortTitlePages: Array<{
			_id: string;
			url: string;
			title?: string | null;
			titleLength?: number | null;
		}>;
		longTitlePages: Array<{
			_id: string;
			url: string;
			title?: string | null;
			titleLength?: number | null;
		}>;
		duplicateTitles: Array<{ key: string; count: number; urls: string[]; title: string }>;
		duplicateMeta: Array<{ key: string; count: number; urls: string[]; metaDescription: string }>;
		duplicateContent: Array<{ key: string; count: number; urls: string[] }>;
		a11y: {
			missingAlt: SeoSampleIdUrl[];
			anchorsWithoutText: SeoSampleIdUrl[];
			noH1: SeoSampleIdUrl[];
			multipleH1: SeoSampleIdUrl[];
		};
		images: {
			largeImages: Array<{ pageId: string; pageUrl: string; imageUrl: string }>;
		};
	};
	type SeoResponse = {
		siteId: string;
		total: number;
		thresholds: { slowMs: number; minTitleLen: number; maxTitleLen: number; largeImageMinW: number; largeImageMinH: number; largeImageMinArea: number };
		issues: {
			missingTitle: number;
			missingMeta: number;
			slow: number;
			non200: number;
			missingCanonical: number;
			titleTooShort: number;
			titleTooLong: number;
			a11y: {
				pagesWithMissingAlt: number;
				pagesWithAnchorNoText: number;
				pagesWithNoH1: number;
				pagesWithMultipleH1: number;
			};
			images: {
				totalImages: number;
				largeImages: number;
				formats: Record<string, number>;
			};
			duplicateTitles: number;
			duplicateMeta: number;
			duplicateContent: number;
		};
		samples: SeoSamples;
	};
	let data = $state<SeoResponse | null>(null);
	let showA11y = $state(true);
	let showImages = $state(true);

	async function loadSeo() {
		try {
			const res = await fetch(`/api/seo?siteId=${encodeURIComponent(siteId)}&slowMs=${slowMs}`);
			if (!res.ok) throw new Error('Failed to load SEO data');
			data = await res.json();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Failed to load SEO data: ${msg}`);
		}
	}
	onMount(() => {
		loadSeo();
	});
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<section class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">SEO: <code>{siteId}</code></h1>
		<a href={resolve(`/sites/${siteId}`)} class="btn">Back to site</a>
	</div>

	{#if data}
		<div class="card bg-base-200">
			<div class="card-body">
				<p class="mb-2 text-sm opacity-70">Large image counts are computed at crawl-time by the worker using thresholds: width ≥ {data.thresholds.largeImageMinW}, height ≥ {data.thresholds.largeImageMinH}, or area ≥ {data.thresholds.largeImageMinArea}.</p>
				<div class="flex flex-wrap items-end gap-4">
					<div class="form-control w-48">
						<label class="label" for="th"><span class="label-text">Slow threshold (ms)</span></label
						>
						<input
							id="th"
							class="input-bordered input"
							type="number"
							min="0"
							bind:value={slowMs}
							onkeydown={(e) => e.key === 'Enter' && loadSeo()}
						/>
					</div>
					<button class="btn" onclick={loadSeo}>Reload</button>
					<div class="ml-auto flex items-center gap-4">
						<label class="label cursor-pointer gap-2"><span class="label-text">A11y</span><input type="checkbox" class="toggle" bind:checked={showA11y} /></label>
						<label class="label cursor-pointer gap-2"><span class="label-text">Images</span><input type="checkbox" class="toggle" bind:checked={showImages} /></label>
					</div>
				</div>
				<ul class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Missing title</div>
						<div class="stat-value text-lg">{data.issues.missingTitle}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Missing meta</div>
						<div class="stat-value text-lg">{data.issues.missingMeta}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Slow (&gt;{data.thresholds.slowMs}ms)</div>
						<div class="stat-value text-lg">{data.issues.slow}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Non-200</div>
						<div class="stat-value text-lg">{data.issues.non200}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Missing canonical</div>
						<div class="stat-value text-lg">{data.issues.missingCanonical}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Title too short (&lt;{data.thresholds.minTitleLen})</div>
						<div class="stat-value text-lg">{data.issues.titleTooShort}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Title too long (&gt;{data.thresholds.maxTitleLen})</div>
						<div class="stat-value text-lg">{data.issues.titleTooLong}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Duplicate titles</div>
						<div class="stat-value text-lg">{data.issues.duplicateTitles}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Duplicate meta</div>
						<div class="stat-value text-lg">{data.issues.duplicateMeta}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Duplicate content</div>
						<div class="stat-value text-lg">{data.issues.duplicateContent}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Alt missing (pages)</div>
						<div class="stat-value text-lg">{data.issues.a11y.pagesWithMissingAlt}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Anchors no text (pages)</div>
						<div class="stat-value text-lg">{data.issues.a11y.pagesWithAnchorNoText}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Pages with no H1</div>
						<div class="stat-value text-lg">{data.issues.a11y.pagesWithNoH1}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Pages with multiple H1</div>
						<div class="stat-value text-lg">{data.issues.a11y.pagesWithMultipleH1}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Images (total)</div>
						<div class="stat-value text-lg">{data.issues.images.totalImages}</div>
					</li>
					<li class="stat rounded-box bg-base-100">
						<div class="stat-title">Large images</div>
						<div class="stat-value text-lg">{data.issues.images.largeImages}</div>
					</li>
				</ul>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{#if showA11y}
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Accessibility: images missing alt</h2>
					<ul class="ml-5 list-disc">
						{#each data.samples.a11y.missingAlt as it (it._id)}
							<li class="truncate">
								<a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a>
							</li>
						{/each}
						{#if data.samples.a11y.missingAlt.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Accessibility: anchors without text</h2>
					<ul class="ml-5 list-disc">
						{#each data.samples.a11y.anchorsWithoutText as it (it._id)}
							<li class="truncate">
								<a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a>
							</li>
						{/each}
						{#if data.samples.a11y.anchorsWithoutText.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Accessibility: H1 issues</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>Type</th><th>URL</th></tr></thead>
							<tbody>
								{#each data.samples.a11y.noH1 as it (it._id)}
									<tr>
										<td>No H1</td>
										<td class="max-w-[420px] truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td>
									</tr>
								{/each}
								{#each data.samples.a11y.multipleH1 as it (it._id)}
									<tr>
										<td>Multiple H1</td>
										<td class="max-w-[420px] truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td>
									</tr>
								{/each}
								{#if data.samples.a11y.noH1.length === 0 && data.samples.a11y.multipleH1.length === 0}
									<tr><td colspan="2" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			{/if}
			{#if showImages}
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Images</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>Format</th><th>Count</th></tr></thead>
							<tbody>
								{#each Object.entries(data.issues.images.formats) as it (it[0])}
									<tr><td class="uppercase">{it[0]}</td><td>{it[1]}</td></tr>
								{/each}
							</tbody>
						</table>
						<p class="mt-2 text-sm opacity-70">Total images: {data.issues.images.totalImages}; Large images (w≥{data.thresholds.largeImageMinW} or h≥{data.thresholds.largeImageMinH} or area≥{data.thresholds.largeImageMinArea}): {data.issues.images.largeImages}</p>
					</div>
					<h3 class="mt-4 font-semibold">Sample large images</h3>
					<ul class="ml-5 list-disc">
						{#each data.samples.images.largeImages as it (it.pageUrl + it.imageUrl)}
							<li class="truncate flex items-center gap-2">
								Page: <a class="link" href={it.pageUrl} target="_blank" rel="noopener">{it.pageUrl}</a>
								— Image: <a class="link" href={it.imageUrl} target="_blank" rel="noopener">{it.imageUrl}</a>
								<a class="btn btn-ghost btn-xs" href={resolve(`/analyzer/page/${it.pageId}`)}>View</a>
							</li>
						{/each}
						{#if data.samples.images.largeImages.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
				</div>
			</div>
			{/if}
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Top slow pages</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>URL</th><th>Load (ms)</th><th></th></tr></thead>
							<tbody>
								{#each data.samples.slowPages as it (it._id)}
									<tr>
										<td class="max-w-[420px] truncate"
											><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td
										>
										<td>{it.loadTimeMs}</td>
										<td class="text-right"><a class="btn btn-ghost btn-xs" href={resolve(`/analyzer/page/${it._id}`)}>View</a></td>
									</tr>
								{/each}
								{#if data.samples.slowPages.length === 0}
									<tr><td colspan="3" class="text-center opacity-70">No slow pages</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Missing title</h2>
					<ul class="ml-5 list-disc">
						{#each data.samples.missingTitlePages as it (it._id)}
							<li class="truncate flex items-center gap-2">
								<a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a>
								<a class="btn btn-ghost btn-xs" href={resolve(`/analyzer/page/${it._id}`)}>View</a>
							</li>
						{/each}
						{#if data.samples.missingTitlePages.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Missing meta description</h2>
					<div class="max-h-[360px] overflow-auto pr-2">
					<ul class="ml-5 list-disc">
						{#each data.samples.missingMetaPages as it (it._id)}
							<li class="truncate flex items-center gap-2">
								<a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a>
								<a class="btn btn-ghost btn-xs" href={resolve(`/analyzer/page/${it._id}`)}>View</a>
							</li>
						{/each}
						{#if data.samples.missingMetaPages.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Non-200 pages</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>URL</th><th>Status</th></tr></thead>
							<tbody>
								{#each data.samples.non200Pages as it (it._id)}
									<tr>
										<td class="max-w-[420px] truncate"
											><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td
										>
										<td>{it.statusCode ?? 'n/a'}</td>
										<td class="text-right"><a class="btn btn-ghost btn-xs" href={resolve(`/analyzer/page/${it._id}`)}>View</a></td>
									</tr>
								{/each}
								{#if data.samples.non200Pages.length === 0}
									<tr><td colspan="3" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Missing canonical URL</h2>
					<div class="max-h-[360px] overflow-auto pr-2">
					<ul class="ml-5 list-disc">
						{#each data.samples.missingCanonicalPages as it (it._id)}
							<li class="truncate flex items-center gap-2">
								<a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a>
								<a class="btn btn-ghost btn-xs" href={resolve(`/analyzer/page/${it._id}`)}>View</a>
							</li>
						{/each}
						{#if data.samples.missingCanonicalPages.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Short titles (&lt;{data.thresholds.minTitleLen} chars)</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>Title</th><th>Len</th><th>URL</th></tr></thead>
							<tbody>
								{#each data.samples.shortTitlePages as it (it._id)}
									<tr>
										<td class="max-w-[260px] truncate">{it.title ?? '—'}</td>
										<td>{it.titleLength ?? 'n/a'}</td>
										<td class="max-w-[320px] truncate"
											><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td
										>
									</tr>
								{/each}
								{#if data.samples.shortTitlePages.length === 0}
									<tr><td colspan="3" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Long titles (&gt;{data.thresholds.maxTitleLen} chars)</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>Title</th><th>Len</th><th>URL</th></tr></thead>
							<tbody>
								{#each data.samples.longTitlePages as it (it._id)}
									<tr>
										<td class="max-w-[260px] truncate">{it.title ?? '—'}</td>
										<td>{it.titleLength ?? 'n/a'}</td>
										<td class="max-w-[320px] truncate"
											><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td
										>
									</tr>
								{/each}
								{#if data.samples.longTitlePages.length === 0}
									<tr><td colspan="3" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Duplicate titles</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>Title</th><th>Count</th><th>Sample URLs</th></tr></thead>
							<tbody>
								{#each data.samples.duplicateTitles as it (it.key)}
									<tr>
										<td class="max-w-[260px] truncate">{it.title}</td>
										<td>{it.count}</td>
										<td>
											<ul class="ml-5 list-disc">
												{#each it.urls as u (u)}
													<li class="max-w-[320px] truncate">
														<a class="link" href={u} target="_blank" rel="noopener">{u}</a>
													</li>
												{/each}
											</ul>
										</td>
									</tr>
								{/each}
								{#if data.samples.duplicateTitles.length === 0}
									<tr><td colspan="3" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Duplicate meta descriptions</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>Description</th><th>Count</th><th>Sample URLs</th></tr></thead>
							<tbody>
								{#each data.samples.duplicateMeta as it (it.key)}
									<tr>
										<td class="max-w-[260px] truncate">{it.metaDescription}</td>
										<td>{it.count}</td>
										<td>
											<ul class="ml-5 list-disc">
												{#each it.urls as u (u)}
													<li class="max-w-[320px] truncate">
														<a class="link" href={u} target="_blank" rel="noopener">{u}</a>
													</li>
												{/each}
											</ul>
										</td>
									</tr>
								{/each}
								{#if data.samples.duplicateMeta.length === 0}
									<tr><td colspan="3" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Duplicate content</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>Hash</th><th>Count</th><th>Sample URLs</th></tr></thead>
							<tbody>
								{#each data.samples.duplicateContent as it (it.key)}
									<tr>
										<td class="max-w-[200px] truncate">{it.key}</td>
										<td>{it.count}</td>
										<td>
											<ul class="ml-5 list-disc">
												{#each it.urls as u (u)}
													<li class="max-w-[320px] truncate">
														<a class="link" href={u} target="_blank" rel="noopener">{u}</a>
													</li>
												{/each}
											</ul>
										</td>
									</tr>
								{/each}
								{#if data.samples.duplicateContent.length === 0}
									<tr><td colspan="3" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
