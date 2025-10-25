<script lang="ts">
  let { params } = $props();
  const siteId = params.siteId as string;
  let slowMs = $state(3000);
  let data = $state<any | null>(null);
  let errorMsg = $state<string | null>(null);

  async function loadSeo() {
    errorMsg = null;
    try {
      const res = await fetch(`/api/seo?siteId=${encodeURIComponent(siteId)}&slowMs=${slowMs}`);
      if (!res.ok) throw new Error('Failed to load SEO data');
      data = await res.json();
    } catch (e: any) {
      errorMsg = e?.message || 'Unknown error';
    }
  }
  loadSeo();
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-bold">SEO: <code>{siteId}</code></h1>
    <a href={`/sites/${siteId}`} class="btn">Back to site</a>
  </div>

  {#if errorMsg}
    <div class="alert alert-error"><span>{errorMsg}</span></div>
  {/if}

  {#if data}
    <div class="card bg-base-200">
      <div class="card-body">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="form-control w-48">
            <label class="label" for="th"><span class="label-text">Slow threshold (ms)</span></label>
            <input id="th" class="input input-bordered" type="number" min="0" bind:value={slowMs} onkeydown={(e)=> e.key==='Enter' && loadSeo()} />
          </div>
          <button class="btn" onclick={loadSeo}>Reload</button>
        </div>
        <ul class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <li class="stat bg-base-100 rounded-box"><div class="stat-title">Missing title</div><div class="stat-value text-lg">{data.issues.missingTitle}</div></li>
          <li class="stat bg-base-100 rounded-box"><div class="stat-title">Missing meta</div><div class="stat-value text-lg">{data.issues.missingMeta}</div></li>
          <li class="stat bg-base-100 rounded-box"><div class="stat-title">Slow (&gt;{data.thresholds.slowMs}ms)</div><div class="stat-value text-lg">{data.issues.slow}</div></li>
          <li class="stat bg-base-100 rounded-box"><div class="stat-title">Non-200</div><div class="stat-value text-lg">{data.issues.non200}</div></li>
        </ul>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Top slow pages</h2>
          <div class="overflow-x-auto">
            <table class="table">
              <thead><tr><th>URL</th><th>Load (ms)</th></tr></thead>
              <tbody>
                {#each data.samples.slowPages as it}
                  <tr>
                    <td class="max-w-[420px] truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td>
                    <td>{it.loadTimeMs}</td>
                  </tr>
                {/each}
                {#if data.samples.slowPages.length === 0}
                  <tr><td colspan="2" class="text-center opacity-70">No slow pages</td></tr>
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Missing title</h2>
          <ul class="list-disc ml-5">
            {#each data.samples.missingTitlePages as it}
              <li class="truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></li>
            {/each}
            {#if data.samples.missingTitlePages.length === 0}
              <li class="opacity-70">None</li>
            {/if}
          </ul>
        </div>
      </div>
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Missing meta description</h2>
          <ul class="list-disc ml-5">
            {#each data.samples.missingMetaPages as it}
              <li class="truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></li>
            {/each}
            {#if data.samples.missingMetaPages.length === 0}
              <li class="opacity-70">None</li>
            {/if}
          </ul>
        </div>
      </div>
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Non-200 pages</h2>
          <div class="overflow-x-auto">
            <table class="table">
              <thead><tr><th>URL</th><th>Status</th></tr></thead>
              <tbody>
                {#each data.samples.non200Pages as it}
                  <tr>
                    <td class="max-w-[420px] truncate"><a class="link" href={it.url} target="_blank" rel="noopener">{it.url}</a></td>
                    <td>{it.statusCode ?? 'n/a'}</td>
                  </tr>
                {/each}
                {#if data.samples.non200Pages.length === 0}
                  <tr><td colspan="2" class="text-center opacity-70">None</td></tr>
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>
