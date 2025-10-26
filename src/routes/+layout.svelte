<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
    import { goto } from '$app/navigation';

	import { toasts } from '$lib/stores/toast';
    import { user } from '$lib/stores/user';
    import { signOutUser } from '$lib/auth/firebase';

	let { children } = $props();

	type ThemePref = 'system' | 'light' | 'dark';
	let themePref = $state<ThemePref>('system');

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
					<a href={resolve('/')} class="btn text-xl btn-ghost">Site Analyzer</a>
				</div>
				<!-- header right side intentionally minimal; auth and theme live in the drawer -->
			</div>
		</div>
		<main class="container mx-auto flex-1 px-4 py-6">
			{@render children?.()}
		</main>
		<footer class="footer-center footer bg-base-200 p-4 text-base-content">
			<aside>
				<p>© {new Date().getFullYear()} Site Analyzer</p>
			</aside>
		</footer>
	</div>
	<div class="drawer-side">
		<label for="drawer-toggle" aria-label="close sidebar" class="drawer-overlay"></label>
		<ul class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
			{#if $user}
				<li class="mb-2">
					<div class="flex items-center gap-3">
						{#if $user.photoURL}
							<img src={$user.photoURL} alt="Avatar" class="mask mask-squircle h-10 w-10" />
						{/if}
						<div>
							<div class="font-semibold">{$user.displayName || 'Account'}</div>
							<div class="text-xs opacity-70">{$user.email}</div>
						</div>
					</div>
				</li>
				<li><a href={resolve('/profile')} onclick={closeDrawer}>Profile</a></li>
				<li><button onclick={() => { closeDrawer(); logout(); }}>Logout</button></li>
			{:else}
				<li><a class="btn btn-primary" href={resolve('/login')} onclick={closeDrawer}>Login</a></li>
			{/if}
			<li class="menu-title">Navigation</li>
			<li><a href={resolve('/')} onclick={closeDrawer}>Home</a></li>
			<li><a href={resolve('/analyzer')} onclick={closeDrawer}>Analyzer</a></li>
			<li><a href={resolve('/sites')} onclick={closeDrawer}>Sites</a></li>
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
		</ul>
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
