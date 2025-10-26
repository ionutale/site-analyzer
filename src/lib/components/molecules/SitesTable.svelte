<script lang="ts">
	import { resolve } from '$app/paths';
	export type SiteRow = {
		siteId: string;
		total: number;
		pending: number;
		in_progress: number;
		done: number;
		error: number;
		lastUpdated: string;
	};

	let {
		items,
		showActions = true,
		showDetailed = false
	} = $props<{
		items: SiteRow[];
		showActions?: boolean;
		showDetailed?: boolean;
	}>();
</script>

<div class="overflow-x-auto">
	<table class="table">
		<thead>
			<tr>
				<th>Site</th>
				{#if showDetailed}
					<th>Pending</th>
					<th>In progress</th>
				{/if}
				<th>Done</th>
				<th>Error</th>
				<th>Total</th>
				<th>Updated</th>
				{#if showActions}<th></th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each items as s (s.siteId)}
				<tr>
					<td><code>{s.siteId}</code></td>
					{#if showDetailed}
						<td>{s.pending}</td>
						<td>{s.in_progress}</td>
					{/if}
					<td>{s.done}</td>
					<td>{s.error}</td>
					<td>{s.total}</td>
					<td>{new Date(s.lastUpdated).toLocaleString()}</td>
					{#if showActions}
						<td>
							<div class="btn-group">
								<!-- Use direct href for querystring route to avoid resolve() typing issues -->
								<a class="btn btn-sm" href={`/analyzer?siteId=${encodeURIComponent(s.siteId)}`}
									>Analyzer</a
								>
								<a class="btn btn-sm" href={resolve(`/sites/${s.siteId}`)}>Site</a>
								<a class="btn btn-sm" href={resolve(`/sites/${s.siteId}/seo`)}>SEO</a>
							</div>
						</td>
					{/if}
				</tr>
			{/each}
			{#if items.length === 0}
				<tr><td colspan={showDetailed ? 7 : 5} class="text-center opacity-70">No sites</td></tr>
			{/if}
		</tbody>
	</table>
</div>
