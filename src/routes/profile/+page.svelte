<script lang="ts">
	import { resolve } from '$app/paths';
	import { user } from '$lib/stores/user';
	import { signOutUser } from '$lib/auth/firebase';
	import { toasts } from '$lib/stores/toast';

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
			// ignore
		}
		applyTheme(pref);
	}

	function themeLabel(pref: ThemePref) {
		return pref === 'system' ? 'System' : pref === 'light' ? 'Light' : 'Dark';
	}

	if (typeof window !== 'undefined') {
		try {
			const stored = (localStorage.getItem('themePreference') as ThemePref) || 'system';
			themePref = stored;
		} catch {
			// ignore
		}
	}

	async function logout() {
		try {
			await signOutUser();
			toasts.success('Signed out');
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Sign-out failed: ${msg}`);
		}
	}
</script>

<section class="mx-auto max-w-2xl">
	<h1 class="mb-4 text-3xl font-bold">Your profile</h1>
	{#if $user}
		<div class="card bg-base-200">
			<div class="card-body gap-4">
				<div class="flex items-center gap-4">
					{#if $user.photoURL}
						<img src={$user.photoURL} alt="Avatar" class="mask mask-squircle h-16 w-16" />
					{/if}
					<div>
						<div class="text-lg font-semibold">{$user.displayName || 'Anonymous'}</div>
						<div class="text-sm opacity-70">{$user.email}</div>

						<div class="divider"></div>

						<div>
							<h2 class="mb-2 text-xl font-semibold">Appearance</h2>
							<label class="label"><span class="label-text">Theme</span></label>
							<div class="join">
								<button class="btn join-item" aria-pressed={themePref==='system'} onclick={() => setThemePref('system')}>System</button>
								<button class="btn join-item" aria-pressed={themePref==='light'} onclick={() => setThemePref('light')}>Light</button>
								<button class="btn join-item" aria-pressed={themePref==='dark'} onclick={() => setThemePref('dark')}>Dark</button>
							</div>
							<p class="mt-1 text-sm opacity-70">Current: {themeLabel(themePref)}</p>
						</div>
					</div>
				</div>
				<div class="flex gap-2">
					<a href={resolve('/')} class="btn">Home</a>
					<button class="btn btn-outline" onclick={logout}>Logout</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="alert">
			<span>You're not signed in.</span>
		</div>
		<a href={resolve('/login')} class="btn btn-primary mt-4">Go to Login</a>
	{/if}
</section>
