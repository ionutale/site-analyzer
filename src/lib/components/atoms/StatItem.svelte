<script lang="ts">
	let { title, value } = $props<{ title: string; value: number }>();
</script>

<li class="stat rounded-box bg-base-100">
	<div class="stat-title">{title}</div>
	<div class="stat-value text-lg">{value}</div>
</li>
