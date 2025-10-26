<script lang="ts">
	import StatItem from '$lib/components/atoms/StatItem.svelte';
	let { stats } = $props<{
		stats: {
			pending: number;
			in_progress: number;
			done: number;
			error: number;
			total: number;
		} | null;
	}>();
</script>

{#if stats}
	<ul class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
		<StatItem title="Pending" value={stats.pending} />
		<StatItem title="In progress" value={stats.in_progress} />
		<StatItem title="Done" value={stats.done} />
		<StatItem title="Error" value={stats.error} />
		<StatItem title="Total" value={stats.total} />
	</ul>
{:else}
	<p class="mt-2 text-sm opacity-70">Waiting for first status update…</p>
{/if}
