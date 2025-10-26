<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { signInWithGoogle } from '$lib/auth/firebase';
	import { user } from '$lib/stores/user';
	import { toasts } from '$lib/stores/toast';

	let redirectTo = $state<string>('/');

	onMount(() => {
		try {
			const qp = new URLSearchParams(location.search);
			const r = qp.get('redirect');
			if (r) redirectTo = r;
		} catch {
			// ignore
		}
	});

	async function handleSignIn() {
		try {
			await signInWithGoogle();
			toasts.success('Signed in');
			await goto(redirectTo);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Unknown error';
			toasts.error(`Sign-in failed: ${msg}`);
		}
	}
</script>

<section class="flex min-h-[60vh] items-center justify-center">
	<div class="card w-full max-w-md bg-base-200">
		<div class="card-body items-center gap-4 text-center">
			<h1 class="card-title text-2xl">Sign in</h1>
			<p class="opacity-70">Continue with your Google account to use Site Analyzer.</p>
			<button class="btn btn-primary w-full" onclick={handleSignIn}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M21.35 11.1h-9.18v2.96h5.38c-.23 1.5-1.61 4.39-5.38 4.39-3.24 0-5.89-2.67-5.89-5.96S8.93 6.53 12.17 6.53c1.84 0 3.07.78 3.77 1.45l2.57-2.48C17.09 3.64 14.83 2.7 12.17 2.7 6.93 2.7 2.65 7 2.65 12.24s4.28 9.53 9.52 9.53c5.49 0 9.11-3.86 9.11-9.31 0-.62-.07-1.02-.16-1.36Z"/></svg>
				Continue with Google
			</button>
			<a class="link" href={resolve('/')}>Cancel</a>
		</div>
	</div>
</section>
