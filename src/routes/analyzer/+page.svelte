<script lang="ts">
  import { onMount } from 'svelte';

  let siteUrl = $state('');
  let siteId = $state<string | null>(null);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  let stats = $state<{ pending: number; in_progress: number; done: number; error: number; total: number } | null>(null);
  let timer: any = null;

  async function ingest() {
    errorMsg = null;
    loading = true;
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to ingest sitemap');
      siteId = data.siteId;
      // start polling
      startPolling();
    } catch (err: any) {
      errorMsg = err?.message || 'Unknown error';
    } finally {
      loading = false;
    }
  }

  async function fetchStatus() {
    if (!siteId) return;
    const res = await fetch(`/api/status?siteId=${encodeURIComponent(siteId)}`);
    if (res.ok) {
      const data = await res.json();
      stats = {
        pending: data.pending,
        in_progress: data.in_progress,
        done: data.done,
        error: data.error,
        total: data.total
      };
    }
  }

  function startPolling() {
    if (timer) clearInterval(timer);
    fetchStatus();
    timer = setInterval(fetchStatus, 5000);
  }

  onMount(() => () => timer && clearInterval(timer));
</script>

<section class="max-w-3xl mx-auto p-4 space-y-6">
  <h1 class="text-2xl font-semibold">Site Analyzer</h1>

  <form
    class="flex gap-2"
    onsubmit={(e) => {
      e.preventDefault();
      ingest();
    }}
  >
    <input
      type="url"
      required
      placeholder="https://example.com"
      bind:value={siteUrl}
      class="flex-1 border rounded px-3 py-2"
    />
    <button class="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={loading}>
      {loading ? 'Ingesting…' : 'Ingest sitemap'}
    </button>
  </form>

  {#if errorMsg}
    <p class="text-red-600">{errorMsg}</p>
  {/if}

  {#if siteId}
    <div class="border rounded p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium">Status</h2>
        <code class="text-xs opacity-70">siteId: {siteId}</code>
      </div>
      {#if stats}
        <ul class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          <li class="p-2 rounded bg-gray-50">Pending: <strong>{stats.pending}</strong></li>
          <li class="p-2 rounded bg-gray-50">In progress: <strong>{stats.in_progress}</strong></li>
          <li class="p-2 rounded bg-gray-50">Done: <strong>{stats.done}</strong></li>
          <li class="p-2 rounded bg-gray-50">Error: <strong>{stats.error}</strong></li>
          <li class="p-2 rounded bg-gray-50">Total: <strong>{stats.total}</strong></li>
        </ul>
      {:else}
        <p class="text-sm opacity-70 mt-2">Waiting for first status update…</p>
      {/if}
    </div>
  {/if}
</section>
