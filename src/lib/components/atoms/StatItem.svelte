<script lang="ts">
	let { title, value, loading = false } = $props<{ title: string; value: number; loading?: boolean }>();
</script>

<li class="stat rounded-box bg-base-100">
	<div class="stat-title flex items-center gap-1">
		<span>{title}</span>
	</div>
	<div class="stat-value flex items-center gap-2 text-lg">
		<span>{value}</span>
		{#if loading}
			<span class="loading loading-spinner loading-xs"></span>
		{/if}
	</div>
    
</li>
