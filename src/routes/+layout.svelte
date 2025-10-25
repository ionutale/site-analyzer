<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="p-3 border-b flex gap-4">
		<a href="/" class="hover:underline">Home</a>
		<a href="/analyzer" class="hover:underline">Analyzer</a>
	</nav>

{@render children?.()}
