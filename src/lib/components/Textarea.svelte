<script lang="ts">
  export let value = '';
  export let label = '';
  export let placeholder = '';
  export let error = '';
  export let disabled = false;
  export let required = false;
  export let rows = 4;
  export let id = '';
  export let name = '';
</script>

<div class="textarea-group">
  {#if label}
    <label for={id} class="label"
      >{label}{#if required}<span class="required">*</span>{/if}</label
    >
  {/if}
  <textarea
    {id}
    {name}
    {placeholder}
    {disabled}
    {required}
    {rows}
    bind:value
    class="textarea"
    class:error
    on:input
    on:change
    on:blur
    on:focus
  ></textarea>
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .textarea-group {
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

  .textarea {
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: var(--font-sans);
    color: var(--color-text-primary);
    background-color: var(--color-bg-primary);
    transition: all 0.2s;
    resize: vertical;
    min-height: 80px;
  }

  .textarea:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(107, 127, 255, 0.1);
  }

  .textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--color-bg-tertiary);
  }

  .textarea.error {
    border-color: var(--color-error);
  }

  .textarea.error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .error-text {
    font-size: 0.875rem;
    color: var(--color-error);
  }
</style>
