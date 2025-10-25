<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	import { toasts } from '$lib/stores/toast';

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
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="drawer min-h-screen">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col">
		<div class="navbar bg-base-200">
			<div class="container mx-auto px-4">
				<div class="flex-none lg:hidden">
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
				<div class="hidden flex-none items-center gap-2 lg:flex">
					<ul class="menu menu-horizontal px-1">
						<li><a href={resolve('/')}>Home</a></li>
						<li><a href={resolve('/analyzer')}>Analyzer</a></li>
						<li><a href={resolve('/sites')}>Sites</a></li>
					</ul>
					<div class="tooltip" data-tip={themeLabel()}>
						<button
							class="btn btn-square btn-ghost"
							aria-label={themeLabel()}
							onclick={cycleThemePref}
						>
							{#if themePref === 'light'}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="h-5 w-5"
									><path
										d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1 1 1v1h-2v-1a1 1 0 0 1 1-1Zm0-22a1 1 0 0 1 1-1V0h-2v0a1 1 0 0 1 1-1ZM0 13a1 1 0 0 1-1-1H0v2H0a1 1 0 0 1-1-1Zm24 0a1 1 0 0 1-1 1v0h-2v-2h2v0a1 1 0 0 1 1 1ZM4.222 20.364a1 1 0 0 1 0-1.414l.707-.707 1.414 1.414-.707.707a1 1 0 0 1-1.414 0ZM17.657 6.929l.707-.707a1 1 0 0 1 1.414 1.414l-.707.707-1.414-1.414ZM3.515 5.515a1 1 0 0 1 1.414-1.414l.707.707-1.414 1.414-.707-.707Zm14.142 14.142.707.707a1 1 0 1 1-1.414 1.414l-.707-.707 1.414-1.414Z"
									/></svg
								>
							{:else if themePref === 'dark'}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="h-5 w-5"
									><path d="M21.64 13.64A9 9 0 1 1 10.36 2.36a7 7 0 1 0 11.28 11.28Z" /></svg
								>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="h-5 w-5"
									><path
										d="M6 2a1 1 0 0 1 1 1v1h10V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v2H3V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1ZM3 10h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Z"
									/></svg
								>
							{/if}
						</button>
					</div>
				</div>
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
			<li class="menu-title">Navigation</li>
			<li><a href={resolve('/')}>Home</a></li>
			<li><a href={resolve('/analyzer')}>Analyzer</a></li>
			<li><a href={resolve('/sites')}>Sites</a></li>
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
<div class="toast toast-top toast-end z-50">
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
