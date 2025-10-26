<script lang="ts">
    import { onMount } from 'svelte';
    import { resolve } from '$app/paths';
    import SitesTable from '$lib/components/molecules/SitesTable.svelte';

    type SiteInfo = {
        siteId: string;
        total: number;
        pending: number;
        in_progress: number;
        done: number;
        error: number;
        lastUpdated: string;
    };

    let sites = $state<SiteInfo[]>([]);
    let loading = $state(true);
    let errorMsg = $state<string | null>(null);

    let totals = $state({
        sites: 0,
        analyzed: 0,
        errors: 0
    });

    async function load() {
        loading = true;
        errorMsg = null;
        try {
            const res = await fetch('/api/sites');
            if (!res.ok) throw new Error('Failed to load sites');
            sites = await res.json();
            const analyzed = sites.reduce((acc, s) => acc + (s.done || 0), 0);
            const errors = sites.reduce((acc, s) => acc + (s.error || 0), 0);
            totals = { sites: sites.length, analyzed, errors };
        } catch (e: unknown) {
            errorMsg = e instanceof Error ? e.message : 'Unknown error';
        } finally {
            loading = false;
        }
    }
    onMount(() => {
        load();
    });
</script>

<section class="space-y-6">
    <h1 class="text-3xl font-bold">Dashboard</h1>

    {#if errorMsg}
        <div class="alert alert-error"><span>{errorMsg}</span></div>
    {/if}

    {#if loading}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="stat rounded-box bg-base-200">
                <div class="h-6 w-24 skeleton"></div>
                <div class="h-8 w-16 skeleton"></div>
            </div>
            <div class="stat rounded-box bg-base-200">
                <div class="h-6 w-24 skeleton"></div>
                <div class="h-8 w-16 skeleton"></div>
            </div>
            <div class="stat rounded-box bg-base-200">
                <div class="h-6 w-24 skeleton"></div>
                <div class="h-8 w-16 skeleton"></div>
            </div>
        </div>
        <div class="h-40 w-full skeleton"></div>
    {:else}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="stat rounded-box bg-base-200">
                <div class="stat-title">Sites</div>
                <div class="stat-value text-2xl">{totals.sites}</div>
            </div>
            <div class="stat rounded-box bg-base-200">
                <div class="stat-title">Pages analyzed</div>
                <div class="stat-value text-2xl">{totals.analyzed}</div>
            </div>
            <div class="stat rounded-box bg-base-200">
                <div class="stat-title">Pages with errors</div>
                <div class="stat-value text-2xl">{totals.errors}</div>
            </div>
        </div>

        <div class="card bg-base-200">
            <div class="card-body gap-3">
                <div class="flex items-center justify-between">
                    <h2 class="card-title">Recent sites</h2>
                    <a class="btn btn-sm" href={resolve('/sites')}>All sites</a>
                </div>
                <SitesTable
                    items={sites
                        .slice()
                        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                        .slice(0, 10)}
                    showActions={true}
                    showDetailed={false}
                />
            </div>
        </div>
    {/if}
</section>
