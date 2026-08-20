<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { enhance } from '$app/forms';

  type Suggestion = { name: string; categoryId: string | null; uses: number };
  type Category = { id: string; name: string; color: string | null };

  let {
    categories = [],
    suggestions = []
  }: {
    categories: Category[];
    suggestions: Suggestion[];
  } = $props();

  let name = $state('');
  let quantity = $state('');
  let categoryId = $state('');
  let visibility = $state<'shared' | 'personal'>('shared');
  let showSuggestions = $state(false);
  let submitting = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);

  // Filter the household's past item names client-side; the full list ships
  // with the page so typing doesn't hit the server.
  const matches = $derived.by(() => {
    const q = name.trim().toLowerCase();
    if (q.length === 0) return [];
    return suggestions
      .filter((s) => s.name.toLowerCase().startsWith(q) && s.name.toLowerCase() !== q)
      .slice(0, 6);
  });

  function pick(s: Suggestion) {
    name = s.name;
    // Re-adding a staple should not mean re-picking its category
    if (s.categoryId && categories.some((c) => c.id === s.categoryId)) {
      categoryId = s.categoryId;
    }
    showSuggestions = false;
    inputEl?.focus();
  }
</script>

<form
  method="POST"
  action="?/addItem"
  class="add-form"
  use:enhance={() => {
    submitting = true;
    return async ({ result, update }) => {
      submitting = false;
      await update({ reset: false });
      if (result.type === 'success') {
        // Keep category and visibility so adding several things in a row is fast
        name = '';
        quantity = '';
        showSuggestions = false;
        inputEl?.focus();
      }
    };
  }}
>
  <div class="row">
    <div class="name-field">
      <input
        bind:this={inputEl}
        bind:value={name}
        name="name"
        type="text"
        placeholder="Add an item…"
        autocomplete="off"
        autocapitalize="words"
        required
        oninput={() => (showSuggestions = true)}
        onfocus={() => (showSuggestions = true)}
        onblur={() => setTimeout(() => (showSuggestions = false), 150)}
      />
      {#if showSuggestions && matches.length > 0}
        <ul class="suggestions" role="listbox">
          {#each matches as s (s.name)}
            <li>
              <button type="button" onclick={() => pick(s)}>
                <span class="s-name">{s.name}</span>
                {#if s.uses > 1}
                  <span class="s-uses">added {s.uses}×</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <input
      bind:value={quantity}
      name="quantity"
      type="text"
      class="qty-field"
      placeholder="Qty"
      autocomplete="off"
    />
  </div>

  <div class="row secondary">
    <select bind:value={categoryId} name="categoryId" aria-label="Category">
      <option value="">Uncategorised</option>
      {#each categories as c (c.id)}
        <option value={c.id}>{c.name}</option>
      {/each}
    </select>

    <select bind:value={visibility} name="visibility" aria-label="Who can see this">
      <option value="shared">Shared</option>
      <option value="personal">Just me</option>
    </select>

    <Button type="submit" variant="primary" disabled={submitting || name.trim() === ''}>
      {submitting ? 'Adding…' : 'Add'}
    </Button>
  </div>
</form>

<style>
  .add-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-lg);
  }

  .row {
    display: flex;
    gap: var(--space-sm);
  }

  .name-field {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .name-field input,
  .qty-field,
  select {
    /* 16px minimum: iOS Safari zooms the page for anything smaller */
    font-size: 16px;
    padding: 0 var(--space-sm);
    min-height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
  }

  .name-field input {
    width: 100%;
  }

  .qty-field {
    width: 5.5rem;
    flex-shrink: 0;
  }

  .name-field input:focus,
  .qty-field:focus,
  select:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  .secondary {
    align-items: center;
  }

  .secondary select {
    flex: 1;
    min-width: 0;
  }

  /* Rendered below the input so the on-screen keyboard doesn't cover it */
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
    box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.18));
    max-height: 15rem;
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

  .s-uses {
    color: var(--color-text-tertiary);
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  @media (max-width: 767px) {
    .add-form {
      border-radius: var(--radius-md);
      padding: var(--space-sm);
    }

    .secondary :global(.btn) {
      flex-shrink: 0;
    }
  }
</style>
