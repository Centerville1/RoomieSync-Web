<script lang="ts">
  import { onMount } from 'svelte';

  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let showClose = true;

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      open = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      open = false;
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  });

  $: if (open) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
</script>

{#if open}
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div class="modal modal-{size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        {#if title}
          <h2 id="modal-title" class="modal-title">{title}</h2>
        {/if}
        {#if showClose}
          <button class="close-btn" onclick={() => (open = false)} aria-label="Close modal">
            ×
          </button>
        {/if}
      </div>
      <div class="modal-body">
        <slot />
      </div>
      {#if $$slots.footer}
        <div class="modal-footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-md);
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal {
    background-color: var(--color-bg-primary);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    max-height: 90vh;
    overflow: auto;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-sm {
    width: 100%;
    max-width: 400px;
  }

  .modal-md {
    width: 100%;
    max-width: 600px;
  }

  .modal-lg {
    width: 100%;
    max-width: 800px;
  }

  .modal-xl {
    width: 100%;
    max-width: 1200px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .close-btn:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: var(--space-lg);
  }

  .modal-footer {
    padding: var(--space-lg);
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: var(--space-md);
    justify-content: flex-end;
  }
</style>
