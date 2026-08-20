<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import Button from '$lib/components/Button.svelte';
  import AddItemForm from './AddItemForm.svelte';
  import CategoryManagerModal from './CategoryManagerModal.svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let scopeFilter = $state<'shared' | 'personal' | null>(null);
  let categoryFilter = $state<string | null>(null);
  let showPurchased = $state(false);
  let selectedIds = $state<Set<string>>(new Set());
  let showCategoryModal = $state(false);

  // Optimistic purchased state: a Turso round-trip over mobile data is slow
  // enough that an unresponsive checkbox reads as broken.
  let pendingToggles = $state<Map<string, boolean>>(new Map());

  const memberName = $derived.by(() => {
    const map = new Map<string, string>();
    for (const m of data.members) map.set(m.id, m.displayName || m.name);
    return map;
  });

  function isPurchased(item: { id: string; purchasedAt: Date | null }) {
    const pending = pendingToggles.get(item.id);
    return pending !== undefined ? pending : item.purchasedAt !== null;
  }

  const visibleItems = $derived.by(() =>
    data.items.filter((item) => {
      if (!showPurchased && isPurchased(item)) return false;
      if (scopeFilter && item.visibility !== scopeFilter) return false;
      if (categoryFilter !== null && item.categoryId !== categoryFilter) return false;
      return true;
    })
  );

  // Group into the household's categories, with uncategorised last
  const grouped = $derived.by(() => {
    const groups: Array<{ id: string | null; name: string; items: typeof data.items }> = [];
    for (const c of data.categories) {
      const items = visibleItems.filter((i) => i.categoryId === c.id);
      if (items.length > 0) groups.push({ id: c.id, name: c.name, items });
    }
    const loose = visibleItems.filter(
      (i) => i.categoryId === null || !data.categories.some((c) => c.id === i.categoryId)
    );
    if (loose.length > 0) groups.push({ id: null, name: 'Uncategorised', items: loose });
    return groups;
  });

  const openCount = $derived(data.items.filter((i) => !isPurchased(i)).length);

  function toggleScope(scope: 'shared' | 'personal') {
    scopeFilter = scopeFilter === scope ? null : scope;
  }

  function toggleCategory(id: string | null) {
    categoryFilter = categoryFilter === id ? null : id;
  }

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  // A single hidden form drives every row's toggle. Using a real form keeps
  // SvelteKit's action handling rather than hand-rolling the protocol.
  let toggleForm = $state<HTMLFormElement | null>(null);
  let toggleItemId = $state('');
  let togglePurchasedValue = $state('true');

  function togglePurchased(item: { id: string; purchasedAt: Date | null }) {
    const target = !isPurchased(item);
    pendingToggles = new Map(pendingToggles).set(item.id, target);
    toggleItemId = item.id;
    togglePurchasedValue = String(target);
    toggleForm?.requestSubmit();
  }

  function clearPending(id: string) {
    const next = new Map(pendingToggles);
    next.delete(id);
    pendingToggles = next;
  }

  const selectedItems = $derived(data.items.filter((i) => selectedIds.has(i.id)));

  function formatDate(d: Date | null) {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
  }
</script>

<main class="container">
  <div class="list-header">
    <div>
      <h2>Shopping List</h2>
      <p class="helper">
        {openCount}
        {openCount === 1 ? 'item' : 'items'} to buy
      </p>
    </div>
    <Button variant="outline" size="sm" on:click={() => (showCategoryModal = true)}>
      Categories
    </Button>
  </div>

  <AddItemForm categories={data.categories} suggestions={data.suggestions} />

  {#if form?.error}
    <p class="error-message">{form.error}</p>
  {/if}

  <!-- Filters: scope and category use the same toggle model. No "All" button —
       the unfiltered state is simply no chip active. -->
  <div class="filters">
    <div class="filter-row">
      <span class="filter-label">Scope</span>
      <div class="chips">
        <button
          type="button"
          class="chip"
          class:active={scopeFilter === 'shared'}
          onclick={() => toggleScope('shared')}
        >
          Shared
        </button>
        <button
          type="button"
          class="chip"
          class:active={scopeFilter === 'personal'}
          onclick={() => toggleScope('personal')}
        >
          Mine
        </button>
      </div>
    </div>

    {#if data.categories.length > 0}
      <div class="filter-row">
        <span class="filter-label">Category</span>
        <div class="chips">
          {#each data.categories as c (c.id)}
            <button
              type="button"
              class="chip"
              class:active={categoryFilter === c.id}
              onclick={() => toggleCategory(c.id)}
            >
              {c.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <label class="show-purchased">
      <input type="checkbox" bind:checked={showPurchased} />
      Show purchased
    </label>
  </div>

  {#if grouped.length === 0}
    <div class="empty">
      {#if data.items.length === 0}
        <p>Nothing on the list yet. Add the first item above.</p>
      {:else}
        <p>No items match these filters.</p>
      {/if}
    </div>
  {:else}
    {#each grouped as group (group.id ?? 'none')}
      <section class="group">
        <h3 class="group-title">{group.name}</h3>
        <ul class="items">
          {#each group.items as item (item.id)}
            {@const purchased = isPurchased(item)}
            <li class="item" class:purchased class:selected={selectedIds.has(item.id)}>
              <label class="check">
                <input
                  type="checkbox"
                  checked={purchased}
                  onchange={() => togglePurchased(item)}
                  aria-label="Mark {item.name} purchased"
                />
              </label>

              <button type="button" class="body" onclick={() => toggleSelected(item.id)}>
                <span class="line-1">
                  <span class="name">{item.name}</span>
                  {#if item.quantity}
                    <span class="qty">{item.quantity}</span>
                  {/if}
                </span>
                <span class="line-2">
                  {#if item.visibility === 'personal'}
                    <span class="badge-personal">Just me</span>
                  {:else}
                    <span class="meta">Shared</span>
                    <span class="meta">· {memberName.get(item.addedBy) ?? 'Someone'}</span>
                  {/if}
                  {#if item.notes}
                    <span class="meta notes">· {item.notes}</span>
                  {/if}
                  {#if purchased && item.purchasedBy}
                    <span class="meta">
                      · got by {memberName.get(item.purchasedBy) ?? 'someone'}
                      {formatDate(item.purchasedAt)}
                    </span>
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</main>

<!-- Drives the per-row purchased toggle -->
<form
  bind:this={toggleForm}
  method="POST"
  action="?/togglePurchased"
  class="hidden-form"
  use:enhance={() => {
    const id = toggleItemId;
    return async ({ result, update }) => {
      await update({ reset: false });
      // On failure the optimistic flip is dropped so the row shows the truth
      clearPending(id);
      if (result.type === 'error' || result.type === 'failure') {
        await invalidateAll();
      }
    };
  }}
>
  <input type="hidden" name="itemId" value={toggleItemId} />
  <input type="hidden" name="purchased" value={togglePurchasedValue} />
</form>

<!-- Bulk action bar: one selection model drives both remove and split -->
{#if selectedIds.size > 0}
  <div class="bulk-bar" role="region" aria-label="Selected items">
    <span class="bulk-count">{selectedIds.size} selected</span>
    <div class="bulk-actions">
      <button type="button" class="bulk-clear" onclick={() => (selectedIds = new Set())}>
        Clear
      </button>
      <form
        method="POST"
        action="?/removeItems"
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: false });
            selectedIds = new Set();
          };
        }}
      >
        {#each selectedItems as item (item.id)}
          <input type="hidden" name="itemIds" value={item.id} />
        {/each}
        <Button type="submit" variant="danger" size="sm">Remove</Button>
      </form>
    </div>
  </div>
{/if}

<CategoryManagerModal bind:open={showCategoryModal} categories={data.categories} />

<style>
  main {
    padding: var(--space-xl) var(--space-md) 6rem;
  }

  .hidden-form {
    display: none;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .list-header h2 {
    margin: 0;
    color: var(--color-text-primary);
  }

  .helper {
    margin: var(--space-xs) 0 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .error-message {
    margin: 0 0 var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
    color: var(--color-error);
    font-size: 0.9rem;
  }

  /* Filters */
  .filters {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .filter-label {
    flex-shrink: 0;
    width: 4.5rem;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-tertiary);
  }

  .chips {
    display: flex;
    gap: var(--space-xs);
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }

  .chips::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex-shrink: 0;
    min-height: 36px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background-color: var(--color-bg-primary);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .chip:hover {
    border-color: var(--color-text-tertiary);
    color: var(--color-text-primary);
  }

  .chip.active {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }

  .show-purchased {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    min-height: 36px;
  }

  .show-purchased input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
  }

  /* Groups */
  .group {
    margin-bottom: var(--space-lg);
  }

  .group-title {
    margin: 0 0 var(--space-sm);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-tertiary);
  }

  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item {
    display: flex;
    align-items: stretch;
    gap: var(--space-xs);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .item.selected {
    border-color: var(--color-primary);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  .item.purchased .name {
    text-decoration: line-through;
    color: var(--color-text-tertiary);
  }

  .check {
    display: flex;
    align-items: center;
    padding: 0 var(--space-xs) 0 var(--space-md);
    cursor: pointer;
  }

  .check input {
    width: 22px;
    height: 22px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  /* The whole row body is the selection target, not a small checkbox */
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
    min-height: 52px;
    padding: var(--space-sm) var(--space-md) var(--space-sm) var(--space-xs);
    border: none;
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .line-1 {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    min-width: 0;
    width: 100%;
  }

  .name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .qty {
    flex-shrink: 0;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  /* Single truncated meta line: scope, adder, notes */
  .line-2 {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    font-size: 0.8rem;
  }

  .meta {
    color: var(--color-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .notes {
    font-style: italic;
  }

  /* Never truncates: it is the only signal the item is private */
  .badge-personal {
    flex-shrink: 0;
    padding: 1px 0.4rem;
    border-radius: 999px;
    background-color: var(--color-secondary);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .empty {
    padding: var(--space-xl);
    text-align: center;
    color: var(--color-text-secondary);
    background-color: var(--color-bg-primary);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
  }

  .empty p {
    margin: 0;
  }

  /* Bulk bar */
  .bulk-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md);
    /* Clears the iPhone home indicator */
    padding-bottom: calc(var(--space-md) + env(safe-area-inset-bottom));
    background-color: var(--color-bg-primary);
    border-top: 1px solid var(--color-border);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
  }

  .bulk-count {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .bulk-clear {
    min-height: 44px;
    padding: 0 var(--space-sm);
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .bulk-clear:hover {
    color: var(--color-text-primary);
  }

  @media (max-width: 767px) {
    main {
      padding: var(--space-lg) var(--space-md) 6rem;
    }

    .filter-label {
      display: none;
    }

    .group {
      margin-bottom: var(--space-md);
    }
  }
</style>
