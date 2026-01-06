<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled = false;
  export let fullWidth = false;
  export let form: string | undefined = undefined;
</script>

<button
  {type}
  {disabled}
  {form}
  class="btn btn-{variant} btn-{size}"
  class:full-width={fullWidth}
  on:click
>
  <slot />
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    font-weight: 600;
    border-radius: var(--radius-md);
    transition: all 0.2s;
    cursor: pointer;
    border: none;
    font-family: var(--font-sans);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn-sm {
    padding: var(--space-xs) var(--space-md);
    font-size: 0.875rem;
  }

  .btn-md {
    padding: var(--space-sm) var(--space-lg);
    font-size: 1rem;
  }

  .btn-lg {
    padding: var(--space-md) var(--space-xl);
    font-size: 1.125rem;
  }

  /* Variants */
  .btn-primary {
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
  }

  .btn-secondary {
    background-color: var(--color-secondary);
    color: var(--color-text-inverse);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-secondary-hover);
  }

  .btn-outline {
    background-color: transparent;
    color: var(--color-primary);
    border: 2px solid var(--color-primary);
  }

  .btn-outline:hover:not(:disabled) {
    background-color: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .btn-ghost {
    background-color: transparent;
    color: var(--color-text-primary);
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary);
  }

  .btn-danger {
    background-color: var(--color-error);
    color: var(--color-text-inverse);
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .btn-success {
    background-color: var(--color-success);
    color: var(--color-text-inverse);
  }

  .btn-success:hover:not(:disabled) {
    background-color: #059669;
  }

  .full-width {
    width: 100%;
  }
</style>
