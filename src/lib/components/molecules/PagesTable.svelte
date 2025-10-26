<script lang="ts">
  import { resolve } from '$app/paths';

  export type PageItem = {
    _id: string;
    url: string;
    title?: string | null;
    statusCode?: number | null;
    fetchedAt: string;
    contentType?: string | null;
  };

  let { items } = $props<{ items: PageItem[] }>();
</script>

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
      {#each items as pg (pg._id)}
        <tr>
          <td class="max-w-[320px] truncate">{pg.title || '—'}</td>
          <td class="max-w-[420px] truncate">
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a class="link" href={pg.url} target="_blank" rel="noopener">{pg.url}</a>
          </td>
          <td>{pg.statusCode ?? 'n/a'}</td>
          <td>{new Date(pg.fetchedAt).toLocaleString()}</td>
          <td>{pg.contentType ?? 'n/a'}</td>
          <td><a class="btn btn-sm" href={resolve(`/analyzer/page/${pg._id}`)}>Open</a></td>
        </tr>
      {/each}
      {#if items.length === 0}
        <tr><td colspan="6" class="text-center opacity-70">No pages</td></tr>
      {/if}
    </tbody>
  </table>
</div>
