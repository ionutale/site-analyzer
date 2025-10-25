<script lang="ts">
  let { data } = $props();
  const page = data.page;
</script>

<section class="max-w-4xl mx-auto p-4 space-y-4">
  <a href="/analyzer" class="text-blue-600 hover:underline">← Back to Analyzer</a>

  {#if page}
    <h1 class="text-2xl font-semibold">{page.title || page.url}</h1>
    <div class="text-sm opacity-70">{page.url}</div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div class="p-2 rounded bg-gray-50">Status: <strong>{page.statusCode ?? 'n/a'}</strong></div>
      <div class="p-2 rounded bg-gray-50">Fetched: <strong>{new Date(page.fetchedAt).toLocaleString()}</strong></div>
      <div class="p-2 rounded bg-gray-50">Type: <strong>{page.contentType ?? 'n/a'}</strong></div>
    </div>

    <h2 class="text-lg font-medium mt-4">Excerpt</h2>
    <pre class="p-3 bg-gray-100 rounded overflow-x-auto whitespace-pre-wrap">{page.textExcerpt ?? ''}</pre>

    <details class="mt-3">
      <summary class="cursor-pointer text-blue-600">Show raw HTML</summary>
      <pre class="p-3 bg-gray-100 rounded overflow-x-auto whitespace-pre-wrap">{page.content}</pre>
    </details>
  {:else}
    <p class="text-red-600">Failed to load page.</p>
  {/if}
</section>
