<script lang="ts">
	import type { Snippet } from 'svelte';

	let { page, max, total, onPrev, onNext, children } = $props<{
		page: number;
		max: number;
		total: number;
		onPrev: () => void;
		onNext: () => void;
		children?: Snippet;
	}>();
</script>

<div class="flex items-center justify-between gap-2">
	<button class="btn" onclick={onPrev} disabled={page <= 1}>Prev</button>
	<div class="text-sm">Page {page} of {max} • {total} total</div>
	<button class="btn" onclick={onNext} disabled={page >= max}>Next</button>
	{@render children?.()}
</div>
