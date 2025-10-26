<script lang="ts">
	import { resolve } from '$app/paths';
	import { user } from '$lib/stores/user';
	import logo from '$lib/assets/logo.svg';
</script>

<section class="space-y-6">
	<!-- Public landing hero -->
	<div class="hero rounded-box bg-base-200 py-10">
		<div class="hero-content flex-col lg:flex-row">
			<img src={logo} alt="Site Analyzer" class="h-16 w-16" />
			<div>
				<h1 class="text-4xl font-bold">Site Analyzer</h1>
				<p class="py-4 max-w-xl opacity-80">
					Ingest sitemaps, process pages in parallel with Playwright, and get instant SEO insights.
					Track status live, browse content, and spot issues across your site.
				</p>
				<div class="flex gap-2">
					{#if $user}
						<a class="btn btn-primary" href={resolve('/dashboard')}>Open dashboard</a>
					{:else}
						<a class="btn btn-primary" href={resolve('/login')}>Get started</a>
					{/if}
					<a class="btn" href="https://playwright.dev/" target="_blank" rel="noreferrer">Learn more</a>
				</div>
			</div>
		</div>
	</div>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<div class="stat rounded-box bg-base-200">
			<div class="stat-title">Ingest sitemaps</div>
			<div class="stat-desc">Bulk store URLs with preserved ordering</div>
		</div>
		<div class="stat rounded-box bg-base-200">
			<div class="stat-title">Process in parallel</div>
			<div class="stat-desc">Configurable concurrency and draining</div>
		</div>
		<div class="stat rounded-box bg-base-200">
			<div class="stat-title">SEO insights</div>
			<div class="stat-desc">Titles, meta, duplicates, slow pages</div>
		</div>
	</div>
</section>
