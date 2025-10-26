<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ change: number }>();

  let { page, max, total }: { page: number; max: number; total?: number } = $props();

  function go(delta: number) {
    const next = Math.min(max, Math.max(1, page + delta));
    if (next !== page) dispatch('change', next);
  }
</script>

<div class="flex items-center gap-2">
  <button class="btn" disabled={page <= 1} onclick={() => go(-1)}>Prev</button>
  <div class="text-sm">Page {page} of {max}{total != null ? ` • ${total} total` : ''}</div>
  <button class="btn" disabled={page >= max} onclick={() => go(1)}>Next</button>
</div>
