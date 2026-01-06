<script lang="ts">
  export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  export let shadow: 'none' | 'sm' | 'md' | 'lg' = 'sm';
  export let hover = false;
</script>

<div class="card padding-{padding} shadow-{shadow}" class:hover>
  <slot />
</div>

<style>
  .card {
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: all 0.2s;
  }

  .card.hover:hover {
    border-color: var(--color-border-hover);
    transform: translateY(-2px);
  }

  /* Padding variants */
  .padding-none {
    padding: 0;
  }

  .padding-sm {
    padding: var(--space-md);
  }

  .padding-md {
    padding: var(--space-lg);
  }

  .padding-lg {
    padding: var(--space-xl);
  }

  /* Shadow variants */
  .shadow-none {
    box-shadow: none;
  }

  .shadow-sm {
    box-shadow: var(--shadow-sm);
  }

  .shadow-md {
    box-shadow: var(--shadow-md);
  }

  .shadow-lg {
    box-shadow: var(--shadow-lg);
  }

  .hover.shadow-sm:hover {
    box-shadow: var(--shadow-md);
  }

  .hover.shadow-md:hover {
    box-shadow: var(--shadow-lg);
  }
</style>
