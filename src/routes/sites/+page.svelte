<script lang="ts">
	import { onMount } from 'svelte';
	import { toasts } from '$lib/stores/toast';
	import SitesTable from '$lib/components/molecules/SitesTable.svelte';
  import PaginationControls from '$lib/components/molecules/PaginationControls.svelte';
	let sites = $state<
		Array<{
			siteId: string;
			total: number;
			pending: number;
			in_progress: number;
			done: number;
			error: number;
			lastUpdated: string;
		}>
	>([]);
	let loading = $state(true);

  // pagination state
  let page = $state(1);
  let pageSize = $state(20);
  function clampPage() {
    const max = Math.max(1, Math.ceil(sites.length / pageSize));
    if (page > max) page = max;
    if (page < 1) page = 1;
  }

	async function loadSites() {
		loading = true;
		try {
			const res = await fetch('/api/sites');
			if (!res.ok) throw new Error('Failed to load sites');
			sites = await res.json();
			clampPage();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Failed to load sites: ${msg}`);
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		loadSites();
	});

  $effect(() => {
    // in case pageSize changes
    clampPage();
  });

  function pageItems() {
    const start = (page - 1) * pageSize;
    return sites.slice(start, start + pageSize);
  }
</script>

<section class="space-y-4">
	<h1 class="text-3xl font-bold">Sites</h1>

	{#if loading}
		<div class="h-8 w-64 skeleton"></div>
		<div class="h-32 w-full skeleton"></div>
	{:else}
		<div class="flex items-center justify-between">
			<div class="text-sm opacity-70">{sites.length} total</div>
			<PaginationControls
				page={page}
				max={Math.max(1, Math.ceil(sites.length / pageSize))}
				total={sites.length}
				on:change={(e) => (page = e.detail)}
			/>
		</div>
		<SitesTable items={pageItems()} showActions={true} showDetailed={true} />
		<div class="mt-3 flex justify-end">
			<PaginationControls
				page={page}
				max={Math.max(1, Math.ceil(sites.length / pageSize))}
				total={sites.length}
				on:change={(e) => (page = e.detail)}
			/>
		</div>
	{/if}
</section>
