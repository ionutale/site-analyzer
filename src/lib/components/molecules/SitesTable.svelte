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
		showDetailed = false,
		enableSorting = true,
		initialSortKey = 'updated',
		initialSortDir = 'desc'
	} = $props<{
		items: SiteRow[];
		showActions?: boolean;
		showDetailed?: boolean;
		enableSorting?: boolean;
		initialSortKey?: 'site' | 'pending' | 'in_progress' | 'done' | 'error' | 'total' | 'updated';
		initialSortDir?: 'asc' | 'desc';
	}>();

	// local sorting state
	let sortKey = $state<typeof initialSortKey>(initialSortKey);
	let sortDir = $state<typeof initialSortDir>(initialSortDir);

	function setSort(key: typeof initialSortKey) {
		if (!enableSorting) return;
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = key === 'site' ? 'asc' : 'desc';
		}
	}

	function arrowFor(key: typeof initialSortKey) {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? ' ▲' : ' ▼';
	}

	function compare(a: SiteRow, b: SiteRow, key: typeof initialSortKey) {
		let av: number | string = 0;
		let bv: number | string = 0;
		switch (key) {
			case 'site':
				av = a.siteId;
				bv = b.siteId;
				break;
			case 'pending':
				av = a.pending;
				bv = b.pending;
				break;
			case 'in_progress':
				av = a.in_progress;
				bv = b.in_progress;
				break;
			case 'done':
				av = a.done;
				bv = b.done;
				break;
			case 'error':
				av = a.error;
				bv = b.error;
				break;
			case 'total':
				av = a.total;
				bv = b.total;
				break;
			case 'updated':
				av = new Date(a.lastUpdated).getTime();
				bv = new Date(b.lastUpdated).getTime();
				break;
		}
		if (typeof av === 'string' && typeof bv === 'string') {
			return av.localeCompare(bv);
		}
		return (av as number) - (bv as number);
	}

	function sorted(list: SiteRow[]) {
		if (!enableSorting) return list;
		const out = list.slice().sort((a, b) => compare(a, b, sortKey));
		return sortDir === 'asc' ? out : out.reverse();
	}
</script>

<div class="overflow-x-auto">
	<table class="table">
		<thead>
			<tr>
				<th class={enableSorting ? 'cursor-pointer select-none' : ''} onclick={() => setSort('site')}
					>Site{arrowFor('site')}</th
				>
				{#if showDetailed}
					<th class={enableSorting ? 'cursor-pointer select-none' : ''} onclick={() => setSort('pending')}
						>Pending{arrowFor('pending')}</th
					>
					<th class={enableSorting ? 'cursor-pointer select-none' : ''} onclick={() => setSort('in_progress')}
						>In progress{arrowFor('in_progress')}</th
					>
				{/if}
				<th class={enableSorting ? 'cursor-pointer select-none' : ''} onclick={() => setSort('done')}
					>Done{arrowFor('done')}</th
				>
				<th class={enableSorting ? 'cursor-pointer select-none' : ''} onclick={() => setSort('error')}
					>Error{arrowFor('error')}</th
				>
				<th class={enableSorting ? 'cursor-pointer select-none' : ''} onclick={() => setSort('total')}
					>Total{arrowFor('total')}</th
				>
				<th class={enableSorting ? 'cursor-pointer select-none' : ''} onclick={() => setSort('updated')}
					>Updated{arrowFor('updated')}</th
				>
				{#if showActions}<th></th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each sorted(items) as s (s.siteId)}
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
				<tr>
					<td colspan={(showDetailed ? 6 : 4) + (showActions ? 1 : 0)} class="text-center opacity-70">
						<div class="flex flex-col items-center gap-2 py-4">
							<div>No sites yet.</div>
							<a class="btn btn-sm" href={resolve('/analyzer')}>Ingest a new site</a>
						</div>
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>
