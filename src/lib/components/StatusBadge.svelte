<script lang="ts">
  let { status } = $props<{ status: string }>();

  function badgeClass(s: string): string {
    switch (s) {
      case 'done':
        return 'badge-success';
      case 'error':
        return 'badge-error';
      case 'fetching':
        return 'badge-info';
      case 'in_progress':
        return 'badge-warning';
      default:
        return '';
    }
  }
</script>

<span class="badge {badgeClass(status)}">{status}</span>
