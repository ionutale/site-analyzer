<script lang="ts">
	import { resolve } from '$app/paths';
	import { user } from '$lib/stores/user';
	import { signOutUser } from '$lib/auth/firebase';
	import { toasts } from '$lib/stores/toast';

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
