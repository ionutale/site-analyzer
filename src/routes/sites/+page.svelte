<script lang="ts">
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
	let errorMsg = $state<string | null>(null);

	async function loadSites() {
		loading = true;
		errorMsg = null;
		try {
			const res = await fetch('/api/sites');
			if (!res.ok) throw new Error('Failed to load sites');
			sites = await res.json();
		} catch (e: any) {
			errorMsg = e?.message || 'Unknown error';
		} finally {
			loading = false;
		}
	}
	loadSites();
</script>

<section class="space-y-4">
	<h1 class="text-3xl font-bold">Sites</h1>

	{#if errorMsg}
		<div class="alert alert-error"><span>{errorMsg}</span></div>
	{/if}

	{#if loading}
		<div class="h-8 w-64 skeleton"></div>
		<div class="h-32 w-full skeleton"></div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Site</th>
						<th>Pending</th>
						<th>In progress</th>
						<th>Done</th>
						<th>Error</th>
						<th>Total</th>
						<th>Last updated</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each sites as s}
						<tr>
							<td><code>{s.siteId}</code></td>
							<td>{s.pending}</td>
							<td>{s.in_progress}</td>
							<td>{s.done}</td>
							<td>{s.error}</td>
							<td>{s.total}</td>
							<td>{new Date(s.lastUpdated).toLocaleString()}</td>
							<td><a class="btn btn-sm" href={`/sites/${s.siteId}`}>Open</a></td>
						</tr>
					{/each}
					{#if sites.length === 0}
						<tr><td colspan="8" class="text-center opacity-70">No sites yet</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>
