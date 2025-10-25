<script lang="ts">
	import { resolve } from '$app/paths';
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
	};
	type SeoResponse = {
		siteId: string;
		total: number;
		thresholds: { slowMs: number; minTitleLen: number; maxTitleLen: number };
		issues: {
			missingTitle: number;
			missingMeta: number;
			slow: number;
			non200: number;
			missingCanonical: number;
			titleTooShort: number;
			titleTooLong: number;
			duplicateTitles: number;
			duplicateMeta: number;
		};
		samples: SeoSamples;
	};
	let data = $state<SeoResponse | null>(null);
	let errorMsg = $state<string | null>(null);

	async function loadSeo() {
		errorMsg = null;
		try {
			const res = await fetch(`/api/seo?siteId=${encodeURIComponent(siteId)}&slowMs=${slowMs}`);
			if (!res.ok) throw new Error('Failed to load SEO data');
			data = await res.json();
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : 'Unknown error';
		}
	}
	loadSeo();
</script>

<section class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">SEO: <code>{siteId}</code></h1>
		<a href={resolve(`/sites/${siteId}`)} class="btn">Back to site</a>
	</div>

	{#if errorMsg}
		<div class="alert alert-error"><span>{errorMsg}</span></div>
	{/if}

	{#if data}
		<div class="card bg-base-200">
			<div class="card-body">
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
				</ul>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Top slow pages</h2>
					<div class="overflow-x-auto">
						<table class="table">
							<thead><tr><th>URL</th><th>Load (ms)</th></tr></thead>
							<tbody>
								{#each data.samples.slowPages as it (it._id)}
									<tr>
										<td class="max-w-[420px] truncate"
											><a class="link" href={resolve(it.url)} target="_blank" rel="noopener"
												>{it.url}</a
											></td
										>
										<td>{it.loadTimeMs}</td>
									</tr>
								{/each}
								{#if data.samples.slowPages.length === 0}
									<tr><td colspan="2" class="text-center opacity-70">No slow pages</td></tr>
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
							<li class="truncate">
								<a class="link" href={resolve(it.url)} target="_blank" rel="noopener">{it.url}</a>
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
					<ul class="ml-5 list-disc">
						{#each data.samples.missingMetaPages as it (it._id)}
							<li class="truncate">
								<a class="link" href={resolve(it.url)} target="_blank" rel="noopener">{it.url}</a>
							</li>
						{/each}
						{#if data.samples.missingMetaPages.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
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
											><a class="link" href={resolve(it.url)} target="_blank" rel="noopener"
												>{it.url}</a
											></td
										>
										<td>{it.statusCode ?? 'n/a'}</td>
									</tr>
								{/each}
								{#if data.samples.non200Pages.length === 0}
									<tr><td colspan="2" class="text-center opacity-70">None</td></tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Missing canonical URL</h2>
					<ul class="ml-5 list-disc">
						{#each data.samples.missingCanonicalPages as it (it._id)}
							<li class="truncate">
								<a class="link" href={resolve(it.url)} target="_blank" rel="noopener">{it.url}</a>
							</li>
						{/each}
						{#if data.samples.missingCanonicalPages.length === 0}
							<li class="opacity-70">None</li>
						{/if}
					</ul>
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
											><a class="link" href={resolve(it.url)} target="_blank" rel="noopener"
												>{it.url}</a
											></td
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
											><a class="link" href={resolve(it.url)} target="_blank" rel="noopener"
												>{it.url}</a
											></td
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
														<a class="link" href={resolve(u)} target="_blank" rel="noopener">{u}</a>
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
														<a class="link" href={resolve(u)} target="_blank" rel="noopener">{u}</a>
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
		</div>
	{/if}
</section>
