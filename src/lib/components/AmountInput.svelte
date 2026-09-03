<script lang="ts">
  import { evaluateExpression, formatAmount } from '$lib/expression';

  let {
    value = $bindable(0),
    name = '',
    id = '',
    label = '',
    placeholder = '0.00',
    required = false,
    disabled = false,
    /** Rendered under the field when the entry is not a valid expression */
    error = '',
    /** Shown while the field is focused, e.g. "= 12.00" */
    showPreview = true
  }: {
    value?: number;
    name?: string;
    id?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    showPreview?: boolean;
  } = $props();

  // What the user typed, which may be an expression like "10 + 0.2*10".
  // Kept separate from `value` so focusing the field gives the workings back.
  let raw = $state('');
  let focused = $state(false);
  let touched = $state(false);

  // Seed from the bound value, and follow it when it changes from outside
  // (a split override being recalculated, say) unless the user is mid-edit.
  let lastExternal = $state<number | null>(null);
  $effect(() => {
    if (focused) return;
    if (value !== lastExternal) {
      lastExternal = value;
      raw = value === 0 && !touched ? '' : formatAmount(value);
    }
  });

  const evaluated = $derived(evaluateExpression(raw));
  const isExpression = $derived(raw.trim() !== '' && /[+\-*/()]/.test(raw.trim()));
  const invalid = $derived(raw.trim() !== '' && evaluated === null);

  function commit() {
    focused = false;
    if (evaluated !== null) {
      value = evaluated;
      lastExternal = evaluated;
      // Collapse the workings into the result once the field loses focus
      raw = formatAmount(evaluated);
    }
  }

  function onFocus() {
    focused = true;
    touched = true;
  }

  function onInput() {
    touched = true;
    if (evaluated !== null) {
      value = evaluated;
      lastExternal = evaluated;
    }
  }
</script>

<div class="amount-field">
  {#if label}
    <label for={id}
      >{label}{#if required}<span class="req">*</span>{/if}</label
    >
  {/if}
  <div class="input-wrap">
    <span class="currency" aria-hidden="true">$</span>
    <input
      {id}
      {placeholder}
      {disabled}
      bind:value={raw}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      class:invalid
      onfocus={onFocus}
      oninput={onInput}
      onblur={commit}
      onkeydown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
    <!-- The form posts the resolved number, never the expression -->
    <input type="hidden" {name} value={evaluated ?? ''} />
  </div>

  {#if invalid}
    <p class="hint error">That is not a number or a sum we can work out.</p>
  {:else if error}
    <p class="hint error">{error}</p>
  {:else if showPreview && focused && isExpression && evaluated !== null}
    <p class="hint">= {formatAmount(evaluated)}</p>
  {/if}
</div>

<style>
  .amount-field {
    display: flex;
    flex-direction: column;
  }

  label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .req {
    color: var(--color-error);
    margin-left: 2px;
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .currency {
    position: absolute;
    left: var(--space-sm);
    color: var(--color-text-tertiary);
    pointer-events: none;
  }

  input[type='text'] {
    width: 100%;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    min-height: 44px;
    padding: 0 var(--space-sm) 0 1.6rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-variant-numeric: tabular-nums;
  }

  input[type='text']:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  input.invalid {
    border-color: var(--color-error);
  }

  .hint {
    margin: var(--space-xs) 0 0;
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    min-height: 1rem;
  }

  .hint.error {
    color: var(--color-error);
  }
</style>
