<script lang="ts">
  export let type: 'text' | 'email' | 'password' | 'number' | 'date' | 'tel' = 'text';
  export let value = '';
  export let label = '';
  export let placeholder = '';
  export let error = '';
  export let disabled = false;
  export let required = false;
  export let id = '';
  export let name = '';
  // Number-specific props
  export let min: number | string | undefined = undefined;
  export let max: number | string | undefined = undefined;
  export let step: number | string | undefined = undefined;
</script>

<div class="input-group">
  {#if label}
    <label for={id} class="label"
      >{label}{#if required}<span class="required">*</span>{/if}</label
    >
  {/if}
  <input
    {id}
    {name}
    {type}
    {placeholder}
    {disabled}
    {required}
    {min}
    {max}
    {step}
    bind:value
    class="input"
    class:error
    on:input
    on:change
    on:blur
    on:focus
  />
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .required {
    color: var(--color-error);
    margin-left: 2px;
  }

  .input {
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: var(--font-sans);
    color: var(--color-text-primary);
    background-color: var(--color-bg-primary);
    transition: all 0.2s;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(107, 127, 255, 0.1);
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--color-bg-tertiary);
  }

  .input.error {
    border-color: var(--color-error);
  }

  .input.error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .error-text {
    font-size: 0.875rem;
    color: var(--color-error);
  }
</style>
