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
    purchasedBy: string | null;
  };

  let {
    open = $bindable(false),
    categories = [],
    suggestions = [],
    item = null,
    purchasedByName = null,
    isOwner = false
  }: {
    open: boolean;
    categories: Category[];
    suggestions: Suggestion[];
    /** null = adding a new item, otherwise editing this one */
    item?: Item | null;
    /** Display name of whoever bought it, when it is already purchased */
    purchasedByName?: string | null;
    /** True when the current user added this item; only they may change its scope */
    isOwner?: boolean;
  } = $props();

  // Only credit a buyer while the item is still marked purchased, and only the
  // one recorded on the row — not whoever is about to press the button.
  const purchaseCredit = $derived(
    item && item.purchasedAt !== null && item.purchasedBy ? purchasedByName : null
  );

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

  // Matches anywhere in the name, not just the start, so "towels" finds
  // "Paper Towels". Prefix matches still rank first, then by how often the item
  // has been added, so the most likely candidate stays at the top.
  const matches = $derived.by(() => {
    if (isEdit) return [];
    const q = name.trim().toLowerCase();
    if (q.length === 0) return [];
    return suggestions
      .map((s) => ({ s, at: s.name.toLowerCase().indexOf(q) }))
      .filter(({ s, at }) => at !== -1 && s.name.toLowerCase() !== q)
      .sort((a, b) => {
        const aPrefix = a.at === 0 ? 0 : 1;
        const bPrefix = b.at === 0 ? 0 : 1;
        return aPrefix - bPrefix || b.s.uses - a.s.uses || a.s.name.localeCompare(b.s.name);
      })
      .slice(0, 6)
      .map(({ s }) => s);
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
    // An emptied number input binds to null, so coerce before the arithmetic
    quantity = Math.max(1, (Number(quantity) || 1) + by);
  }

  // Guarantees a valid number reaches the server even if the field is left blank
  function normalizeQuantity() {
    quantity = Math.max(1, Math.floor(Number(quantity) || 1));
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
              disabled={(Number(quantity) || 1) <= 1}
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
              required
              onblur={normalizeQuantity}
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
          id="item-notes"
          name="notes"
          label="Notes (optional)"
          placeholder="e.g. 2% not whole, the big box"
          rows={2}
        />
      </div>

      {#if isEdit && isOwner}
        <div class="field">
          <span class="field-label">Who can see this</span>
          <div class="scope-toggle">
            <button
              type="button"
              class="scope-option"
              class:active={visibility === 'shared'}
              onclick={() => (visibility = 'shared')}
            >
              Everyone
            </button>
            <button
              type="button"
              class="scope-option"
              class:active={visibility === 'personal'}
              onclick={() => (visibility = 'personal')}
            >
              Just me
            </button>
          </div>
        </div>
      {/if}

      {#if isEdit}
        <!-- An action, not a statement of fact: the button says what pressing it
             does, and the state above it says where the item currently stands. -->
        <div class="purchase-block" class:is-purchased={purchased}>
          {#if purchased}
            <p class="purchase-state">
              <span class="tick" aria-hidden="true">✓</span>
              Purchased{purchaseCredit ? ` by ${purchaseCredit}` : ''}
            </p>
            <button type="button" class="purchase-action undo" onclick={() => (purchased = false)}>
              Move back to the list
            </button>
          {:else}
            <button type="button" class="purchase-action" onclick={() => (purchased = true)}>
              <span class="tick" aria-hidden="true">✓</span>
              Mark as purchased
            </button>
          {/if}
        </div>
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

  .field-label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .scope-toggle {
    display: flex;
    gap: 2px;
    padding: 3px;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
  }

  .scope-option {
    flex: 1;
    min-height: 40px;
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    background: transparent;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }

  .scope-option.active {
    background-color: var(--color-bg-primary);
    color: var(--color-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  }

  .purchase-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-secondary);
  }

  .purchase-block.is-purchased {
    border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
    background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
  }

  .purchase-state {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-success);
  }

  .purchase-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-success);
    border-radius: var(--radius-md);
    background-color: transparent;
    color: var(--color-success);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .purchase-action:hover {
    background-color: color-mix(in srgb, var(--color-success) 14%, transparent);
  }

  /* The reverse action is secondary; it should not compete with the tick */
  .purchase-action.undo {
    min-height: 40px;
    border-color: var(--color-border);
    color: var(--color-text-secondary);
    font-size: 0.88rem;
    font-weight: 500;
  }

  .purchase-action.undo:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .tick {
    font-size: 1rem;
    line-height: 1;
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
