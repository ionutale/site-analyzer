<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import StatusBadge from '$lib/components/atoms/StatusBadge.svelte';

  export type LinkItem = {
    _id: string;
    url: string;
    status: string;
    attempts: number;
    updatedAt: string;
    pageId?: string | null;
  };

  const dispatch = createEventDispatcher<{ selectionChange: Set<string> }>();

  let { items, selected = new Set<string>() } = $props<{
    items: LinkItem[];
    selected?: Set<string>;
  }>();

  function setSelected(next: Set<string>) {
    selected = next;
    // Notify parent; pass a new Set to ensure immutability
    dispatch('selectionChange', new Set<string>([...(selected as Set<string>)]));
  }

  function toggleAll(checked: boolean) {
  setSelected(checked ? new Set(items.map((i: LinkItem) => i._id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    const next = new Set<string>([...(selected as Set<string>)]);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  $effect(() => {
    // prune selection when items change
  const visibleIds = new Set(items.map((i: LinkItem) => i._id));
  setSelected(new Set<string>([...selected].filter((id) => visibleIds.has(id))));
  });
</script>

<div class="overflow-x-auto">
  <table class="table">
    <thead>
      <tr>
        <th>
          <input
            type="checkbox"
            checked={items.length > 0 && selected.size === items.length}
            indeterminate={selected.size > 0 && selected.size < items.length}
            onchange={(e) => toggleAll((e.target as HTMLInputElement).checked)}
          />
        </th>
        <th>URL</th>
        <th>Status</th>
        <th>Attempts</th>
        <th>Updated</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each items as it (it._id)}
        <tr>
          <td>
            <input
              type="checkbox"
              checked={selected.has(it._id)}
              onchange={(e) => toggleOne(it._id, (e.target as HTMLInputElement).checked)}
            />
          </td>
          <td class="max-w-[420px] truncate">
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a>
          </td>
          <td>
            <StatusBadge status={it.status} />
          </td>
          <td>{it.attempts}</td>
          <td>{new Date(it.updatedAt).toLocaleString()}</td>
          <td>
            {#if it.pageId}
              <a class="btn btn-sm" href={`/analyzer/page/${it.pageId}`}>View</a>
            {:else}
              <span class="text-sm opacity-50">n/a</span>
            {/if}
          </td>
        </tr>
      {/each}
      {#if items.length === 0}
        <tr><td colspan="5" class="text-center opacity-70">No items</td></tr>
      {/if}
    </tbody>
  </table>
  
</div>
