<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import { enhance } from '$app/forms';

  type Suggestion = { name: string; categoryId: string | null; uses: number };
  type Category = { id: string; name: string };
  type Item = {
    id: string;
    name: string;
    quantity: string | null;
    notes: string | null;
    categoryId: string | null;
    visibility: 'shared' | 'personal';
    purchasedAt: Date | null;
  };

  let {
    open = $bindable(false),
    categories = [],
    suggestions = [],
    item = null
  }: {
    open: boolean;
    categories: Category[];
    suggestions: Suggestion[];
    /** null = adding a new item, otherwise editing this one */
    item?: Item | null;
  } = $props();

  const isEdit = $derived(item !== null);

  let name = $state('');
  let quantity = $state(1);
  let notes = $state('');
  let categoryId = $state('');
  let purchased = $state(false);
  let visibility = $state<'shared' | 'personal'>('shared');
  let showSuggestions = $state(false);
  let formEl = $state<HTMLFormElement | null>(null);
  let nameEl = $state<HTMLInputElement | null>(null);

  // Reload fields whenever the modal opens, so a stale edit never leaks into
  // the next one.
  let lastKey = $state('');
  $effect(() => {
    const key = open ? (item?.id ?? 'new') : '';
    if (key === lastKey) return;
    lastKey = key;
    if (!open) return;

    if (item) {
      name = item.name;
      quantity = parseQuantity(item.quantity);
      notes = item.notes ?? '';
      categoryId = item.categoryId ?? '';
      visibility = item.visibility;
      purchased = item.purchasedAt !== null;
    } else {
      name = '';
      quantity = 1;
      notes = '';
      categoryId = '';
      visibility = 'shared';
      purchased = false;
    }
    showSuggestions = false;
  });

  /** Quantity is stored as text; pull the leading number back out for the stepper. */
  function parseQuantity(raw: string | null): number {
    if (!raw) return 1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  const matches = $derived.by(() => {
    if (isEdit) return [];
    const q = name.trim().toLowerCase();
    if (q.length === 0) return [];
    return suggestions
      .filter((s) => s.name.toLowerCase().startsWith(q) && s.name.toLowerCase() !== q)
      .slice(0, 5);
  });

  function pick(s: Suggestion) {
    name = s.name;
    if (s.categoryId && categories.some((c) => c.id === s.categoryId)) {
      categoryId = s.categoryId;
    }
    showSuggestions = false;
    nameEl?.focus();
  }

  // The save buttons carry the visibility choice, so it is an explicit decision
  // rather than a dropdown nobody notices.
  function saveAs(scope: 'shared' | 'personal') {
    visibility = scope;
    formEl?.requestSubmit();
  }

  function step(by: number) {
    quantity = Math.max(1, quantity + by);
  }
</script>

<Modal bind:open title={isEdit ? 'Edit item' : 'Add an item'} size="md">
  {#snippet children()}
    <form
      bind:this={formEl}
      method="POST"
      action={isEdit ? '?/updateItem' : '?/addItem'}
      id="item-form"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update({ reset: false });
          if (result.type === 'success') open = false;
        };
      }}
    >
      {#if isEdit && item}
        <input type="hidden" name="itemId" value={item.id} />
      {/if}
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="purchased" value={String(purchased)} />

      <div class="field">
        <label for="item-name">Item</label>
        <div class="name-wrap">
          <input
            bind:this={nameEl}
            bind:value={name}
            id="item-name"
            name="name"
            type="text"
            placeholder="What do you need?"
            autocomplete="off"
            autocapitalize="words"
            required
            oninput={() => (showSuggestions = true)}
            onblur={() => setTimeout(() => (showSuggestions = false), 150)}
          />
          {#if showSuggestions && matches.length > 0}
            <ul class="suggestions">
              {#each matches as s (s.name)}
                <li>
                  <button type="button" onclick={() => pick(s)}>
                    <span>{s.name}</span>
                    {#if s.uses > 1}<span class="uses">added {s.uses}×</span>{/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>

      <div class="two-up">
        <div class="field">
          <label for="item-qty">Quantity</label>
          <div class="stepper">
            <button
              type="button"
              onclick={() => step(-1)}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <input
              bind:value={quantity}
              id="item-qty"
              name="quantity"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
            />
            <button type="button" onclick={() => step(1)} aria-label="Increase quantity">+</button>
          </div>
        </div>

        <div class="field">
          <label for="item-cat">Category</label>
          <select bind:value={categoryId} id="item-cat" name="categoryId">
            <option value="">Uncategorised</option>
            {#each categories as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="field">
        <Textarea
          bind:value={notes}
          name="notes"
          label="Notes (optional)"
          placeholder="e.g. 2% not whole, the big box"
          rows={2}
        />
      </div>

      {#if isEdit}
        <label class="purchased-toggle">
          <input type="checkbox" bind:checked={purchased} />
          <span>Already purchased</span>
        </label>
      {/if}
    </form>
  {/snippet}

  {#snippet footer()}
    {#if isEdit}
      <Button variant="ghost" on:click={() => (open = false)}>Cancel</Button>
      <Button type="submit" variant="primary" form="item-form">Save changes</Button>
    {:else}
      <div class="save-group">
        <Button variant="outline" disabled={name.trim() === ''} on:click={() => saveAs('personal')}>
          Just for me
        </Button>
        <Button variant="primary" disabled={name.trim() === ''} on:click={() => saveAs('shared')}>
          Add for everyone
        </Button>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  .field {
    margin-bottom: var(--space-md);
  }

  .field label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .two-up {
    display: flex;
    gap: var(--space-md);
  }

  .two-up .field {
    flex: 1;
    min-width: 0;
  }

  .name-wrap {
    position: relative;
  }

  input[type='text'],
  input[type='number'],
  select {
    width: 100%;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    min-height: 46px;
    padding: 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
  }

  input:focus,
  select:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  /* Stepper */
  .stepper {
    display: flex;
    align-items: stretch;
    gap: var(--space-xs);
  }

  .stepper input {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    /* Native spinners are tiny; the flanking buttons are the touch targets */
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .stepper input::-webkit-outer-spin-button,
  .stepper input::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }

  .stepper button {
    flex-shrink: 0;
    width: 46px;
    min-height: 46px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 1.3rem;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
  }

  .stepper button:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-text-tertiary);
  }

  .stepper button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Suggestions render below the input so the keyboard doesn't cover them */
  .suggestions {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    z-index: 20;
    margin: 0;
    padding: var(--space-xs);
    list-style: none;
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    max-height: 12rem;
    overflow-y: auto;
  }

  .suggestions button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-sm);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    text-align: left;
    cursor: pointer;
  }

  .suggestions button:hover,
  .suggestions button:focus-visible {
    background-color: var(--color-bg-secondary);
    outline: none;
  }

  .uses {
    color: var(--color-text-tertiary);
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .purchased-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: 44px;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .purchased-toggle input {
    width: 20px;
    height: 20px;
    accent-color: var(--color-primary);
  }

  .save-group {
    display: flex;
    gap: var(--space-sm);
    width: 100%;
  }

  .save-group :global(.btn) {
    flex: 1;
  }

  @media (max-width: 480px) {
    .two-up {
      flex-direction: column;
      gap: 0;
    }
  }
</style>
