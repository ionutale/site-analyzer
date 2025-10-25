<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';

  let siteUrl = $state('');
  let siteId = $state<string | null>(null);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  let stats = $state<{ pending: number; in_progress: number; done: number; error: number; total: number } | null>(null);
  let timer: any = null;

  // links table state
  type LinkItem = { _id: string; url: string; status: string; attempts: number; lastError?: string; updatedAt: string; pageId?: string | null };
  let items = $state<LinkItem[]>([]);
  let total = $state(0);
  let page = $state(1);
  let limit = $state(20);
  let statusFilter = $state<string>('');
  let q = $state('');
  let healthOk = $state<boolean | null>(null);
  let sortBy = $state<'updatedAt' | 'url' | 'status' | 'attempts'>('updatedAt');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let onlyErrors = $state(false);
  let selected = $state<Set<string>>(new Set());

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
      // reset filters
      page = 1;
      // start polling
      startPolling();
      await fetchLinks();
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

  async function fetchLinks() {
    if (!siteId) return;
    const params = new URLSearchParams({ siteId, page: String(page), limit: String(limit), sortBy, sortDir });
    if (statusFilter) params.set('status', statusFilter);
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/links?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      items = data.items;
      total = data.total;
      // clear selection for items no longer visible
      const visibleIds = new Set(items.map((i) => i._id));
      selected = new Set([...selected].filter((id) => visibleIds.has(id)));
    }
  }

  function startPolling() {
    if (timer) clearInterval(timer);
    fetchStatus();
    fetchLinks();
    timer = setInterval(async () => {
      await fetchStatus();
      await fetchLinks();
    }, 5000);
  }

  async function checkHealth() {
    const res = await fetch('/api/health');
    healthOk = res.ok;
  }

  async function processBatch() {
    if (!siteId) return;
    const res = await fetch(`/api/process-batch?siteId=${encodeURIComponent(siteId)}&count=3`, { method: 'POST' });
    if (res.ok) {
      await fetchStatus();
      await fetchLinks();
    }
  }

  async function resetSite() {
    if (!siteId) return;
    if (!confirm('Delete all data for this site?')) return;
    const res = await fetch(`/api/reset-site?siteId=${encodeURIComponent(siteId)}`, { method: 'POST' });
    if (res.ok) {
      await fetchStatus();
      await fetchLinks();
    }
  }

  async function batchAction(action: 'retry' | 'purge') {
    if (!siteId || selected.size === 0) return;
    const res = await fetch('/api/links/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siteId, ids: Array.from(selected), action })
    });
    if (res.ok) {
      selected.clear();
      await fetchStatus();
      await fetchLinks();
    }
  }

  onMount(() => () => timer && clearInterval(timer));
</script>

<section class="space-y-6">
  <h1 class="text-3xl font-bold">Site Analyzer</h1>

  <form
    class="flex flex-col sm:flex-row gap-2"
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
      class="input input-bordered w-full"
    />
    <button class="btn btn-primary" disabled={loading}>
      {loading ? 'Ingesting…' : 'Ingest sitemap'}
    </button>
  <button class="btn btn-ghost" type="button" onclick={checkHealth} title="DB health">Health</button>
    {#if healthOk !== null}
      <span class="badge {healthOk ? 'badge-success' : 'badge-error'}">{healthOk ? 'DB OK' : 'DB Issue'}</span>
    {/if}
  </form>

  {#if errorMsg}
    <div class="alert alert-error">
      <span>{errorMsg}</span>
    </div>
  {/if}

  {#if siteId}
    <div class="card bg-base-200">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h2 class="card-title">Status</h2>
          <code class="text-xs opacity-70">siteId: {siteId}</code>
        </div>
        {#if stats}
          <ul class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Pending</div><div class="stat-value text-lg">{stats.pending}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">In progress</div><div class="stat-value text-lg">{stats.in_progress}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Done</div><div class="stat-value text-lg">{stats.done}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Error</div><div class="stat-value text-lg">{stats.error}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Total</div><div class="stat-value text-lg">{stats.total}</div></li>
          </ul>
        {:else}
          <p class="text-sm opacity-70 mt-2">Waiting for first status update…</p>
        {/if}
      </div>
    </div>

    <div class="card bg-base-200">
      <div class="card-body gap-4">
        <div class="flex flex-col sm:flex-row gap-2 items-end">
          <div class="form-control w-full sm:w-48">
            <label class="label" for="statusFilter"><span class="label-text">Status</span></label>
            <select id="statusFilter" class="select select-bordered" bind:value={statusFilter} onchange={() => { page = 1; fetchLinks(); }}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div class="form-control w-full">
            <label class="label" for="searchUrl"><span class="label-text">Search URL</span></label>
            <input id="searchUrl" class="input input-bordered" placeholder="contains…" bind:value={q} onkeydown={(e) => e.key === 'Enter' && (page = 1, fetchLinks())} />
          </div>
          <div class="form-control w-40">
            <label class="label" for="sortBy"><span class="label-text">Sort</span></label>
            <select id="sortBy" class="select select-bordered" bind:value={sortBy} onchange={() => { page = 1; fetchLinks(); }}>
              <option value="updatedAt">Updated</option>
              <option value="url">URL</option>
              <option value="status">Status</option>
              <option value="attempts">Attempts</option>
            </select>
          </div>
          <div class="form-control w-32">
            <label class="label" for="sortDir"><span class="label-text">Direction</span></label>
            <select id="sortDir" class="select select-bordered" bind:value={sortDir} onchange={() => { page = 1; fetchLinks(); }}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
          <div class="form-control w-28">
            <label class="label" for="pageSize"><span class="label-text">Page size</span></label>
            <select id="pageSize" class="select select-bordered" bind:value={limit} onchange={() => { page = 1; fetchLinks(); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div class="flex-1"></div>
          {#if dev}
            <button class="btn btn-secondary" type="button" onclick={processBatch}>Process batch</button>
          {/if}
          <button class="btn" type="button" onclick={() => { onlyErrors = !onlyErrors; statusFilter = onlyErrors ? 'error' : ''; page = 1; fetchLinks(); }}>
            {onlyErrors ? 'Showing: errors' : 'Only errors'}
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={items.length > 0 && selected.size === items.length} indeterminate={selected.size>0 && selected.size<items.length} onchange={(e) => {
                  const c = (e.target as HTMLInputElement).checked; selected = new Set(c ? items.map(i=>i._id) : []);
                }} /></th>
                <th>URL</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each items as it}
                <tr>
                  <td><input type="checkbox" checked={selected.has(it._id)} onchange={(e)=>{
                    const c=(e.target as HTMLInputElement).checked; if(c) selected.add(it._id); else selected.delete(it._id); selected = new Set(selected);
                  }} /></td>
                  <td class="max-w-[420px] truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td>
                  <td>
                    <span class="badge {it.status === 'done' ? 'badge-success' : it.status === 'error' ? 'badge-error' : it.status === 'in_progress' ? 'badge-warning' : ''}">{it.status}</span>
                  </td>
                  <td>{it.attempts}</td>
                  <td>{new Date(it.updatedAt).toLocaleString()}</td>
                  <td>
                    {#if it.pageId}
                      <a class="btn btn-sm" href={`/analyzer/page/${it.pageId}`}>View</a>
                    {:else}
                      <span class="opacity-50 text-sm">n/a</span>
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

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button class="btn btn-outline" disabled={selected.size===0} onclick={() => batchAction('retry')}>Retry selected</button>
            <button class="btn btn-outline btn-error" disabled={selected.size===0} onclick={() => batchAction('purge')}>Purge selected</button>
            <span class="text-sm opacity-70">{selected.size} selected</span>
          </div>
          <button class="btn" onclick={() => { if (page > 1) { page -= 1; fetchLinks(); } }} disabled={page <= 1}>Prev</button>
          <div class="text-sm">Page {page} of {Math.max(1, Math.ceil(total / limit))} • {total} total</div>
          <div class="flex items-center gap-2">
            <button class="btn btn-error" onclick={resetSite} title="Dev only">Reset site</button>
            <button class="btn" onclick={() => { const max = Math.max(1, Math.ceil(total / limit)); if (page < max) { page += 1; fetchLinks(); } }} disabled={page >= Math.max(1, Math.ceil(total / limit))}>Next</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>
