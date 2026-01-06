<script lang="ts">
  export let checked = false;
  export let label = '';
  export let disabled = false;
  export let id = '';
</script>

<div class="checkbox-group">
  <input {id} type="checkbox" bind:checked {disabled} class="checkbox" on:change />
  {#if label}
    <label for={id} class="label">{label}</label>
  {/if}
</div>

<style>
  .checkbox-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .checkbox {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    appearance: none;
    position: relative;
    transition: all 0.2s;
  }

  .checkbox:checked {
    background-color: var(--color-secondary);
    border-color: var(--color-secondary);
  }

  .checkbox:checked::after {
    content: '✓';
    position: absolute;
    color: white;
    font-size: 1rem;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .checkbox:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(107, 127, 255, 0.2);
  }

  .checkbox:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .label {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    cursor: pointer;
    user-select: none;
  }
</style>
