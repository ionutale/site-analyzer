<script lang="ts">
	import { onMount } from 'svelte';
	import { toasts } from '$lib/stores/toast';
	import SitesTable from '$lib/components/molecules/SitesTable.svelte';
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

	async function loadSites() {
		loading = true;
		try {
			const res = await fetch('/api/sites');
			if (!res.ok) throw new Error('Failed to load sites');
			sites = await res.json();
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
</script>

<section class="space-y-4">
	<h1 class="text-3xl font-bold">Sites</h1>

	{#if loading}
		<div class="h-8 w-64 skeleton"></div>
		<div class="h-32 w-full skeleton"></div>
	{:else}
		<SitesTable items={sites} showActions={true} showDetailed={true} />
	{/if}
</section>
