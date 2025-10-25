<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col">
	<div class="navbar bg-base-200">
		<div class="container mx-auto px-4">
			<div class="flex-1">
				<a href="/" class="btn btn-ghost text-xl">Site Analyzer</a>
			</div>
			<div class="flex-none">
				<ul class="menu menu-horizontal px-1">
					<li><a href="/">Home</a></li>
					<li><a href="/analyzer">Analyzer</a></li>
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
