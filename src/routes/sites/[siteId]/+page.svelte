<script lang="ts">
  import { dev } from '$app/environment';
  let { params } = $props();
  const siteId = params.siteId as string;

  let stats = $state<{ pending: number; in_progress: number; done: number; error: number; total: number } | null>(null);
  let links = $state<any[]>([]);
  let pages = $state<any[]>([]);
  let linksTotal = $state(0);
  let pagesTotal = $state(0);

  // filters
  let lq = $state('');
  let lstatus = $state('');
  let lpage = $state(1);
  let llimit = $state(20);
  let lsortBy = $state<'updatedAt' | 'url' | 'status' | 'attempts'>('updatedAt');
  let lsortDir = $state<'asc' | 'desc'>('desc');

  let pq = $state('');
  let ppage = $state(1);
  let plimit = $state(20);
  let psortBy = $state<'fetchedAt' | 'url' | 'title' | 'statusCode'>('fetchedAt');
  let psortDir = $state<'asc' | 'desc'>('desc');

  async function fetchStatus() {
     const res = await fetch(`/api/status?siteId=${encodeURIComponent(siteId)}`);
     if (res.ok) stats = await res.json();
  }
  async function fetchLinks() {
     const qp = new URLSearchParams({ siteId, page: String(lpage), limit: String(llimit), sortBy: lsortBy, sortDir: lsortDir });
     if (lq.trim()) qp.set('q', lq.trim());
     if (lstatus) qp.set('status', lstatus);
     const res = await fetch(`/api/links?${qp}`);
     if (res.ok) { const data = await res.json(); links = data.items; linksTotal = data.total; }
  }
  async function fetchPages() {
     const qp = new URLSearchParams({ siteId, page: String(ppage), limit: String(plimit), sortBy: psortBy, sortDir: psortDir });
     if (pq.trim()) qp.set('q', pq.trim());
     const res = await fetch(`/api/pages?${qp}`);
     if (res.ok) { const data = await res.json(); pages = data.items; pagesTotal = data.total; }
  }
  fetchStatus();
  fetchLinks();
  fetchPages();

  async function resetSite() {
    if (!dev) return;
    if (!confirm('Delete all data for this site?')) return;
    const res = await fetch(`/api/reset-site?siteId=${encodeURIComponent(siteId)}`, { method: 'POST' });
    if (res.ok) { await fetchStatus(); await fetchLinks(); await fetchPages(); }
  }
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-bold">Site: <code>{siteId}</code></h1>
    <div class="flex items-center gap-2">
      <a class="btn" href={`/sites/${siteId}/seo`}>SEO</a>
      {#if dev}
        <button class="btn btn-error" onclick={resetSite}>Reset site</button>
      {/if}
    </div>
  </div>

  {#if stats}
    <div class="card bg-base-200">
      <div class="card-body">
        <div class="flex flex-wrap gap-4 items-center">
          <div>
            <div class="text-sm opacity-70 mb-1">Status distribution</div>
            <div class="flex items-end gap-2 h-24">
              {#each ['pending','in_progress','done','error'] as key}
                {@const val = (stats as any)[key] as number}
                <div class="flex flex-col items-center gap-1">
                  <div class="bg-primary rounded-t w-10" style={`height:${Math.max(2, Math.round((val / Math.max(1, stats.total)) * 96))}px`}></div>
                  <div class="text-xs">{key}</div>
                </div>
              {/each}
            </div>
          </div>
          <div class="divider lg:divider-horizontal"></div>
          <ul class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Pending</div><div class="stat-value text-lg">{stats.pending}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">In progress</div><div class="stat-value text-lg">{stats.in_progress}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Done</div><div class="stat-value text-lg">{stats.done}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Error</div><div class="stat-value text-lg">{stats.error}</div></li>
            <li class="stat bg-base-100 rounded-box"><div class="stat-title">Total</div><div class="stat-value text-lg">{stats.total}</div></li>
          </ul>
        </div>
      </div>
    </div>
  {/if}

  <div class="card bg-base-200">
    <div class="card-body gap-4">
      <div class="flex flex-wrap gap-2 items-end">
        <div class="form-control w-full sm:w-48">
          <label class="label" for="ls"><span class="label-text">Status</span></label>
          <select id="ls" class="select select-bordered" bind:value={lstatus} onchange={() => { lpage = 1; fetchLinks(); }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div class="form-control w-full">
          <label class="label" for="lq"><span class="label-text">Search URL</span></label>
          <input id="lq" class="input input-bordered" placeholder="contains…" bind:value={lq} onkeydown={(e) => e.key === 'Enter' && (lpage = 1, fetchLinks())} />
        </div>
        <div class="form-control w-28">
          <label class="label" for="ll"><span class="label-text">Page size</span></label>
          <select id="ll" class="select select-bordered" bind:value={llimit} onchange={() => { lpage = 1; fetchLinks(); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div class="form-control w-40">
          <label class="label" for="lsb"><span class="label-text">Sort</span></label>
          <select id="lsb" class="select select-bordered" bind:value={lsortBy} onchange={() => { lpage = 1; fetchLinks(); }}>
            <option value="updatedAt">Updated</option>
            <option value="url">URL</option>
            <option value="status">Status</option>
            <option value="attempts">Attempts</option>
          </select>
        </div>
        <div class="form-control w-32">
          <label class="label" for="lsd"><span class="label-text">Direction</span></label>
          <select id="lsd" class="select select-bordered" bind:value={lsortDir} onchange={() => { lpage = 1; fetchLinks(); }}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each links as it}
              <tr>
                <td class="max-w-[420px] truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td>
                <td><span class="badge {it.status === 'done' ? 'badge-success' : it.status === 'error' ? 'badge-error' : it.status === 'in_progress' ? 'badge-warning' : ''}">{it.status}</span></td>
                <td>{it.attempts}</td>
                <td>{new Date(it.updatedAt).toLocaleString()}</td>
                <td>{#if it.pageId}<a class="btn btn-sm" href={`/analyzer/page/${it.pageId}`}>View</a>{:else}<span class="opacity-50 text-sm">n/a</span>{/if}</td>
              </tr>
            {/each}
            {#if links.length === 0}
              <tr><td colspan="5" class="text-center opacity-70">No items</td></tr>
            {/if}
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between">
        <button class="btn" onclick={() => { if (lpage > 1) { lpage -= 1; fetchLinks(); } }} disabled={lpage <= 1}>Prev</button>
        <div class="text-sm">Page {lpage} of {Math.max(1, Math.ceil(linksTotal / llimit))} • {linksTotal} total</div>
        <button class="btn" onclick={() => { const max = Math.max(1, Math.ceil(linksTotal / llimit)); if (lpage < max) { lpage += 1; fetchLinks(); } }} disabled={lpage >= Math.max(1, Math.ceil(linksTotal / llimit))}>Next</button>
      </div>
    </div>
  </div>

  <div class="card bg-base-200">
    <div class="card-body gap-4">
      <div class="flex flex-wrap gap-2 items-end">
        <div class="form-control w-full">
          <label class="label" for="pq"><span class="label-text">Search</span></label>
          <input id="pq" class="input input-bordered" placeholder="title/url contains…" bind:value={pq} onkeydown={(e) => e.key === 'Enter' && (ppage = 1, fetchPages())} />
        </div>
        <div class="form-control w-28">
          <label class="label" for="pl"><span class="label-text">Page size</span></label>
          <select id="pl" class="select select-bordered" bind:value={plimit} onchange={() => { ppage = 1; fetchPages(); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div class="form-control w-40">
          <label class="label" for="psb"><span class="label-text">Sort</span></label>
          <select id="psb" class="select select-bordered" bind:value={psortBy} onchange={() => { ppage = 1; fetchPages(); }}>
            <option value="fetchedAt">Fetched</option>
            <option value="url">URL</option>
            <option value="title">Title</option>
            <option value="statusCode">Status</option>
          </select>
        </div>
        <div class="form-control w-32">
          <label class="label" for="psd"><span class="label-text">Direction</span></label>
          <select id="psd" class="select select-bordered" bind:value={psortDir} onchange={() => { ppage = 1; fetchPages(); }}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>URL</th>
              <th>Status</th>
              <th>Fetched</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each pages as pg}
              <tr>
                <td class="max-w-[320px] truncate">{pg.title || '—'}</td>
                <td class="max-w-[420px] truncate"><a class="link" href={pg.url} target="_blank" rel="noopener">{pg.url}</a></td>
                <td>{pg.statusCode ?? 'n/a'}</td>
                <td>{new Date(pg.fetchedAt).toLocaleString()}</td>
                <td>{pg.contentType ?? 'n/a'}</td>
                <td><a class="btn btn-sm" href={`/analyzer/page/${pg._id}`}>Open</a></td>
              </tr>
            {/each}
            {#if pages.length === 0}
              <tr><td colspan="6" class="text-center opacity-70">No pages</td></tr>
            {/if}
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between">
        <button class="btn" onclick={() => { if (ppage > 1) { ppage -= 1; fetchPages(); } }} disabled={ppage <= 1}>Prev</button>
        <div class="text-sm">Page {ppage} of {Math.max(1, Math.ceil(pagesTotal / plimit))} • {pagesTotal} total</div>
        <button class="btn" onclick={() => { const max = Math.max(1, Math.ceil(pagesTotal / plimit)); if (ppage < max) { ppage += 1; fetchPages(); } }} disabled={ppage >= Math.max(1, Math.ceil(pagesTotal / plimit))}>Next</button>
      </div>
    </div>
  </div>
</section>
