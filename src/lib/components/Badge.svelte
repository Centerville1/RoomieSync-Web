<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' =
    'primary';
  export let size: 'sm' | 'md' = 'md';
</script>

<span class="badge badge-{variant} badge-{size}">
  <slot />
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    border-radius: var(--radius-lg);
    white-space: nowrap;
  }

  .badge-sm {
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
  }

  .badge-md {
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
  }

  .badge-primary {
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .badge-secondary {
    background-color: var(--color-secondary);
    color: var(--color-text-inverse);
  }

  .badge-success {
    background-color: var(--color-success);
    color: var(--color-text-inverse);
  }

  .badge-error {
    background-color: var(--color-error);
    color: var(--color-text-inverse);
  }

  .badge-warning {
    background-color: var(--color-warning);
    color: var(--color-text-inverse);
  }

  .badge-info {
    background-color: var(--color-info);
    color: var(--color-text-inverse);
  }
</style>
