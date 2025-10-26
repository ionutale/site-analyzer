<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
    import logo from '$lib/assets/logo.svg';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';

	import { toasts } from '$lib/stores/toast';
    import { user } from '$lib/stores/user';
    import { signOutUser } from '$lib/auth/firebase';

	let { children } = $props();

	type ThemePref = 'system' | 'light' | 'dark';
	let themePref = $state<ThemePref>('system');
    let authReady = $state(false);

	function applyTheme(pref: ThemePref) {
		if (pref === 'light') {
			document.documentElement.setAttribute('data-theme', 'light');
		} else if (pref === 'dark') {
			document.documentElement.setAttribute('data-theme', 'aqua');
		} else {
			const prefersDark =
				window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.setAttribute('data-theme', prefersDark ? 'aqua' : 'light');
		}
	}

	function setThemePref(pref: ThemePref) {
		themePref = pref;
		try {
			localStorage.setItem('themePreference', pref);
		} catch {
			void 0;
		}
		applyTheme(pref);
	}

	function cycleThemePref() {
		const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
		setThemePref(next[themePref]);
	}

	function themeLabel() {
		return themePref === 'system'
			? 'Theme: system'
			: themePref === 'light'
				? 'Theme: light'
				: 'Theme: dark';
	}

	onMount(() => {
		try {
			const stored = (localStorage.getItem('themePreference') as ThemePref) || 'system';
			themePref = stored;
		} catch {
			void 0;
		}

		// start auth listener
		user.start();
        // mark auth as resolved on first emission
        const unsub = user.subscribe(() => {
            authReady = true;
        });
        return () => unsub();
	});

	// Client-side route guard: require auth for all non-public routes
	const PUBLIC_PATHS = new Set(['/','/login']);
	$effect(() => {
		const pathname = $page.url.pathname;
		const search = $page.url.search;
		const u = $user;
		// Only run in the browser
		if (typeof window === 'undefined') return;
		// Keep a lightweight cookie for SSR guard awareness (dev-only convenience)
		try {
			if (u) document.cookie = 'sa_auth=1; Path=/; SameSite=Lax';
			else document.cookie = 'sa_auth=; Max-Age=0; Path=/; SameSite=Lax';
		} catch {}
		if (!PUBLIC_PATHS.has(pathname) && !u) {
			const redirect = encodeURIComponent(pathname + (search || ''));
			// Build href using a literal path for resolve, then append query string
			const loginBase = resolve('/login');
			(goto as unknown as (href: string) => Promise<void>)(`${loginBase}?redirect=${redirect}`);
		}
	});

	function closeDrawer() {
		const el = document.getElementById('drawer-toggle') as HTMLInputElement | null;
		if (el) el.checked = false;
	}

	async function logout() {
		try {
			await signOutUser();
			toasts.success('Signed out');
			await goto(resolve('/'));
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Sign-out failed: ${msg}`);
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="drawer min-h-screen xl:drawer-open">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col">
		<div class="navbar bg-base-200">
			<div class="container mx-auto px-4">
				<div class="flex-none xl:hidden">
					<label for="drawer-toggle" class="btn btn-square btn-ghost">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="inline-block h-5 w-5 stroke-current"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h16"
							></path></svg
						>
					</label>
				</div>
				<div class="flex-1">
					<a href={resolve('/')} class="btn btn-ghost normal-case text-xl flex items-center gap-2">
						<img src={logo} alt="Site Analyzer" class="h-6 w-6" />
						<span>Site Analyzer</span>
					</a>
				</div>
				<!-- header right side intentionally minimal; auth and theme live in the drawer -->
			</div>
		</div>
		<main class="container mx-auto flex-1 px-4 py-6">
			{#if !authReady && !$page.url.pathname.match(/^\/$|^\/login$/)}
				<div class="flex h-40 items-center justify-center">
					<span class="loading loading-spinner loading-md"></span>
					<span class="ml-2 opacity-70">Loading…</span>
				</div>
			{:else}
				{@render children?.()}
			{/if}
		</main>
		<footer class="footer-center footer bg-base-200 p-4 text-base-content">
			<aside>
				<p>© {new Date().getFullYear()} Site Analyzer</p>
			</aside>
		</footer>
	</div>
	<div class="drawer-side">
		<label for="drawer-toggle" aria-label="close sidebar" class="drawer-overlay"></label>
		<div class="min-h-full w-80 bg-base-200 p-4 text-base-content flex flex-col">
            <!-- Main navigation and tools -->
            <ul class="menu flex-1">
                <li class="menu-title">Navigation</li>
                <li><a href={resolve('/')} onclick={closeDrawer}>Home</a></li>
				{#if $user}
				<li><a href={resolve('/dashboard')} onclick={closeDrawer}>Dashboard</a></li>
				{/if}
				{#if $user}
				<li><a href={resolve('/analyzer')} onclick={closeDrawer}>Analyzer</a></li>
				<li><a href={resolve('/sites')} onclick={closeDrawer}>Sites</a></li>
				{/if}
				{#if $user}
				<li class="mt-4 menu-title">Theme</li>
				<li>
					<div class="tooltip" data-tip={themeLabel()}>
						<button class="btn" onclick={cycleThemePref} aria-label={themeLabel()}>
							{#if themePref === 'light'}
								Light
							{:else if themePref === 'dark'}
								Dark
							{:else}
								System
							{/if}
						</button>
					</div>
				</li>
				{/if}
            </ul>
            <!-- Bottom-anchored auth block -->
            <div class="mt-4 border-t border-base-300 pt-4">
                {#if $user}
                    <div class="mb-2 flex items-center gap-3">
                        {#if $user.photoURL}
                            <img src={$user.photoURL} alt="Avatar" class="mask mask-squircle h-10 w-10" />
                        {/if}
                        <div>
                            <div class="font-semibold">{$user.displayName || 'Account'}</div>
                            <div class="text-xs opacity-70">{$user.email}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <a class="btn btn-ghost" href={resolve('/profile')} onclick={closeDrawer}>Profile</a>
                        <button class="btn" onclick={() => { closeDrawer(); logout(); }}>Logout</button>
                    </div>
                {:else}
                    <a class="btn btn-primary w-full" href={resolve('/login')} onclick={closeDrawer}>Login</a>
                {/if}
            </div>
        </div>
	</div>
</div>

<!-- Toasts container -->
<div class="toast toast-end toast-top z-50">
	{#each $toasts as t (t.id)}
		<div
			class="alert {t.kind === 'success'
				? 'alert-success'
				: t.kind === 'error'
					? 'alert-error'
					: 'alert-info'} shadow"
		>
			<span>{t.message}</span>
			<button class="btn btn-ghost btn-xs" aria-label="Dismiss" onclick={() => toasts.dismiss(t.id)}
				>✕</button
			>
		</div>
	{/each}
</div>
