<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	type ThemePref = 'system' | 'light' | 'dark';
	let themePref = $state<ThemePref>('system');

	function applyTheme(pref: ThemePref) {
		if (pref === 'light') {
			document.documentElement.setAttribute('data-theme', 'light');
		} else if (pref === 'dark') {
			document.documentElement.setAttribute('data-theme', 'aqua');
		} else {
			const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.setAttribute('data-theme', prefersDark ? 'aqua' : 'light');
		}
	}

	function setThemePref(pref: ThemePref) {
		themePref = pref;
		try { localStorage.setItem('themePreference', pref); } catch {}
		applyTheme(pref);
	}

	onMount(() => {
		try {
			const stored = (localStorage.getItem('themePreference') as ThemePref) || 'system';
			themePref = stored;
		} catch {}
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
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block h-5 w-5 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
					</label>
				</div>
				<div class="flex-1">
					<a href="/" class="btn btn-ghost text-xl">Site Analyzer</a>
				</div>
				<div class="flex-none hidden lg:block">
					<ul class="menu menu-horizontal px-1">
						<li><a href="/">Home</a></li>
						<li><a href="/analyzer">Analyzer</a></li>
						<li><a href="/sites">Sites</a></li>
						<li>
							<details>
								<summary>Theme</summary>
								<ul class="p-2 bg-base-200 rounded-box">
									<li><button class="btn btn-ghost btn-sm" onclick={() => setThemePref('system')}>System</button></li>
									<li><button class="btn btn-ghost btn-sm" onclick={() => setThemePref('light')}>Light</button></li>
									<li><button class="btn btn-ghost btn-sm" onclick={() => setThemePref('dark')}>Dark</button></li>
								</ul>
							</details>
						</li>
					</ul>
				</div>
			</div>
		</div>
		<main class="container mx-auto px-4 py-6 flex-1">
			{@render children?.()}
		</main>
		<footer class="footer footer-center bg-base-200 text-base-content p-4">
			<aside>
				<p>© {new Date().getFullYear()} Site Analyzer</p>
			</aside>
		</footer>
	</div>
	<div class="drawer-side">
		<label for="drawer-toggle" aria-label="close sidebar" class="drawer-overlay"></label>
		<ul class="menu p-4 w-80 min-h-full bg-base-200 text-base-content">
			<li class="menu-title">Navigation</li>
			<li><a href="/">Home</a></li>
			<li><a href="/analyzer">Analyzer</a></li>
			<li><a href="/sites">Sites</a></li>
			<li class="menu-title mt-4">Theme</li>
			<li><button class="btn btn-ghost" onclick={() => setThemePref('system')}>System</button></li>
			<li><button class="btn btn-ghost" onclick={() => setThemePref('light')}>Light</button></li>
			<li><button class="btn btn-ghost" onclick={() => setThemePref('dark')}>Dark</button></li>
		</ul>
	</div>
</div>
