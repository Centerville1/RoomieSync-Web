<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import Button from '$lib/components/Button.svelte';
  import ItemFormModal from './ItemFormModal.svelte';
  import CategoryManagerModal from './CategoryManagerModal.svelte';
  import ConfirmPurchaseModal from './ConfirmPurchaseModal.svelte';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type Item = PageData['items'][number];

  let scopeFilter = $state<'all' | 'shared' | 'personal'>('all');
  let categoryFilter = $state<string | null>(null);
  let selectedIds = $state<Set<string>>(new Set());
  let showPurchasedSection = $state(false);
  let showItemModal = $state(false);
  let editingItem = $state<Item | null>(null);
  let showCategoryModal = $state(false);
  let showConfirmPurchase = $state(false);

  const memberName = $derived.by(() => {
    const map = new Map<string, string>();
    for (const m of data.members) map.set(m.id, m.displayName || m.name);
    return map;
  });

  const categoryName = $derived.by(() => {
    const map = new Map<string, string>();
    for (const c of data.categories) map.set(c.id, c.name);
    return map;
  });

  function matchesFilters(item: Item) {
    if (scopeFilter !== 'all' && item.visibility !== scopeFilter) return false;
    if (categoryFilter !== null && item.categoryId !== categoryFilter) return false;
    return true;
  }

  const openItems = $derived(data.items.filter((i) => i.purchasedAt === null && matchesFilters(i)));
  const purchasedItems = $derived(
    data.items.filter((i) => i.purchasedAt !== null && matchesFilters(i))
  );

  // Group open items by category, uncategorised last
  const grouped = $derived.by(() => {
    const groups: Array<{ id: string | null; name: string; items: Item[] }> = [];
    for (const c of data.categories) {
      const items = openItems.filter((i) => i.categoryId === c.id);
      if (items.length > 0) groups.push({ id: c.id, name: c.name, items });
    }
    const loose = openItems.filter(
      (i) => i.categoryId === null || !data.categories.some((c) => c.id === i.categoryId)
    );
    if (loose.length > 0) groups.push({ id: null, name: 'Uncategorised', items: loose });
    return groups;
  });

  const scopeCounts = $derived.by(() => ({
    all: data.items.filter((i) => i.purchasedAt === null).length,
    shared: data.items.filter((i) => i.purchasedAt === null && i.visibility === 'shared').length,
    personal: data.items.filter((i) => i.purchasedAt === null && i.visibility === 'personal').length
  }));

  const selectedItems = $derived(data.items.filter((i) => selectedIds.has(i.id)));
  const allSelectedArePurchased = $derived(
    selectedItems.length > 0 && selectedItems.every((i) => i.purchasedAt !== null)
  );

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function openAdd() {
    editingItem = null;
    showItemModal = true;
  }

  function openEdit(item: Item) {
    editingItem = item;
    showItemModal = true;
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  async function handlePurchaseConfirmed(split: boolean) {
    clearSelection();
    if (!split) return;
    // Nothing is carried over but the intent: the list holds no prices, and
    // items are never linked to the expense they became.
    await goto(`/household/${page.params.id}?split=1`);
  }

  function formatDate(d: Date | null) {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
  }
</script>

<main class="container">
  <div class="page-header">
    <div>
      <h2>Shopping List</h2>
      <p class="helper">
        {scopeCounts.all}
        {scopeCounts.all === 1 ? 'item' : 'items'} to buy
      </p>
    </div>
    <Button variant="ghost" size="sm" on:click={() => (showCategoryModal = true)}>
      Manage categories
    </Button>
  </div>

  {#if form?.error}
    <p class="error-message">{form.error}</p>
  {/if}

  <!-- Filter: one labelled control, always showing which view is active -->
  <div class="filter-bar">
    <span class="filter-caption">Showing</span>
    <div class="segmented" role="group" aria-label="Filter by who can see items">
      <button
        type="button"
        class="seg"
        class:active={scopeFilter === 'all'}
        onclick={() => (scopeFilter = 'all')}
      >
        Everything <span class="seg-count">{scopeCounts.all}</span>
      </button>
      <button
        type="button"
        class="seg"
        class:active={scopeFilter === 'shared'}
        onclick={() => (scopeFilter = 'shared')}
      >
        Shared <span class="seg-count">{scopeCounts.shared}</span>
      </button>
      <button
        type="button"
        class="seg"
        class:active={scopeFilter === 'personal'}
        onclick={() => (scopeFilter = 'personal')}
      >
        Just mine <span class="seg-count">{scopeCounts.personal}</span>
      </button>
    </div>
  </div>

  {#if data.categories.length > 0}
    <div class="chips" role="group" aria-label="Filter by category">
      {#each data.categories as c (c.id)}
        <button
          type="button"
          class="chip"
          class:active={categoryFilter === c.id}
          onclick={() => (categoryFilter = categoryFilter === c.id ? null : c.id)}
        >
          {c.name}
        </button>
      {/each}
    </div>
  {/if}

  <!-- The list, laid out as a table like the expense grid -->
  <div class="table-wrapper">
    <div class="table">
      <!-- Add row, echoing the expense grid's Split the Cost row -->
      <button type="button" class="add-row" onclick={openAdd}>
        <span class="add-plus">+</span>
        <span class="add-text">
          <span class="add-title">Add an item</span>
          <span class="add-sub">Set the category, quantity and notes</span>
        </span>
      </button>

      {#if grouped.length === 0}
        <div class="empty">
          {#if scopeCounts.all === 0}
            <p>Nothing left to buy.</p>
          {:else}
            <p>No items match this filter.</p>
          {/if}
        </div>
      {:else}
        <div class="head-row" aria-hidden="true">
          <span class="col-check"></span>
          <span class="col-name">Item</span>
          <span class="col-qty">Qty</span>
          <span class="col-added">Added by</span>
        </div>

        {#each grouped as group (group.id ?? 'none')}
          <div class="group-head">{group.name}</div>
          {#each group.items as item (item.id)}
            <div class="row" class:selected={selectedIds.has(item.id)}>
              <label class="col-check">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onchange={() => toggleSelected(item.id)}
                  aria-label="Select {item.name}"
                />
              </label>
              <button type="button" class="row-body" onclick={() => openEdit(item)}>
                <span class="col-name">
                  <span class="name-line">
                    <span class="name">{item.name}</span>
                    {#if item.visibility === 'personal'}
                      <span class="pill-mine">Just me</span>
                    {/if}
                  </span>
                  {#if item.notes}
                    <span class="notes">{item.notes}</span>
                  {/if}
                </span>
                <span class="col-qty">{item.quantity ?? '1'}</span>
                <span class="col-added">{memberName.get(item.addedBy) ?? '—'}</span>
              </button>
            </div>
          {/each}
        {/each}
      {/if}
    </div>
  </div>

  <!-- Purchased items: collapsed by default, replacing the old checkbox -->
  {#if purchasedItems.length > 0}
    <div class="purchased-section">
      <button
        type="button"
        class="purchased-toggle"
        onclick={() => (showPurchasedSection = !showPurchasedSection)}
        aria-expanded={showPurchasedSection}
      >
        <span class="caret" class:open={showPurchasedSection}>▸</span>
        Previously purchased
        <span class="purchased-count">{purchasedItems.length}</span>
      </button>

      {#if showPurchasedSection}
        <div class="table-wrapper purchased-table">
          <div class="table">
            {#each purchasedItems as item (item.id)}
              <div class="row purchased" class:selected={selectedIds.has(item.id)}>
                <label class="col-check">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onchange={() => toggleSelected(item.id)}
                    aria-label="Select {item.name}"
                  />
                </label>
                <button type="button" class="row-body" onclick={() => openEdit(item)}>
                  <span class="col-name">
                    <span class="name-line">
                      <span class="name">{item.name}</span>
                      {#if item.visibility === 'personal'}
                        <span class="pill-mine">Just me</span>
                      {/if}
                    </span>
                    <span class="notes">
                      {memberName.get(item.purchasedBy ?? '') ?? 'Someone'} · {formatDate(
                        item.purchasedAt
                      )}
                      {#if item.categoryId && categoryName.get(item.categoryId)}
                        · {categoryName.get(item.categoryId)}
                      {/if}
                    </span>
                  </span>
                  <span class="col-qty">{item.quantity ?? '1'}</span>
                  <span class="col-added">{memberName.get(item.addedBy) ?? '—'}</span>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</main>

<!-- Bulk bar: selection drives mark-purchased and remove -->
{#if selectedIds.size > 0}
  <div class="bulk-bar" role="region" aria-label="Selected items">
    <div class="bulk-left">
      <span class="bulk-count">{selectedIds.size} selected</span>
      <button type="button" class="bulk-clear" onclick={clearSelection}>Clear</button>
    </div>
    <div class="bulk-actions">
      {#if allSelectedArePurchased}
        <!-- Undoing needs no confirmation; it puts things back on the list -->
        <form
          method="POST"
          action="?/setPurchased"
          use:enhance={() => {
            return async ({ update }) => {
              await update({ reset: false });
              clearSelection();
            };
          }}
        >
          {#each selectedItems as item (item.id)}
            <input type="hidden" name="itemIds" value={item.id} />
          {/each}
          <input type="hidden" name="purchased" value="false" />
          <Button type="submit" variant="primary" size="sm">Move back to list</Button>
        </form>
      {:else}
        <Button variant="primary" size="sm" on:click={() => (showConfirmPurchase = true)}>
          Mark purchased
        </Button>
      {/if}

      <form
        method="POST"
        action="?/removeItems"
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: false });
            clearSelection();
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

<ItemFormModal
  bind:open={showItemModal}
  categories={data.categories}
  suggestions={data.suggestions}
  item={editingItem}
  purchasedByName={editingItem?.purchasedBy
    ? (memberName.get(editingItem.purchasedBy) ?? null)
    : null}
/>

<ConfirmPurchaseModal
  bind:open={showConfirmPurchase}
  items={selectedItems}
  onDone={handlePurchaseConfirmed}
/>

<CategoryManagerModal bind:open={showCategoryModal} categories={data.categories} />

<style>
  main {
    padding: var(--space-xl) var(--space-md) 6rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .page-header h2 {
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

  /* Filter bar */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .filter-caption {
    flex-shrink: 0;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-tertiary);
  }

  .segmented {
    display: flex;
    flex: 1;
    min-width: 0;
    padding: 3px;
    gap: 2px;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
  }

  .seg {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0 var(--space-sm);
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    background: transparent;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .seg:hover:not(.active) {
    color: var(--color-text-primary);
  }

  .seg.active {
    background-color: var(--color-bg-primary);
    color: var(--color-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  }

  .seg-count {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
  }

  /* Category chips */
  .chips {
    display: flex;
    gap: var(--space-xs);
    overflow-x: auto;
    scrollbar-width: none;
    margin-bottom: var(--space-md);
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

  /* Table — mirrors the expense grid's framing */
  .table-wrapper {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: var(--color-bg-primary);
    overflow: hidden;
  }

  .table {
    display: flex;
    flex-direction: column;
  }

  /* Add row */
  .add-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    padding: var(--space-md);
    border: none;
    border-bottom: 1px solid var(--color-border);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .add-row:hover {
    background-color: var(--color-bg-tertiary);
  }

  .add-plus {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: var(--color-primary);
    color: #fff;
    font-size: 1.4rem;
    font-weight: 600;
    line-height: 1;
  }

  .add-text {
    display: flex;
    flex-direction: column;
  }

  .add-title {
    font-weight: 700;
    font-size: 1rem;
  }

  .add-sub {
    font-size: 0.82rem;
    color: var(--color-text-secondary);
  }

  /* Rows */
  .head-row {
    display: grid;
    grid-template-columns: 48px 1fr 4rem 7rem;
    align-items: center;
    padding-right: var(--space-md);
    background-color: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-tertiary);
  }

  .head-row .col-name,
  .head-row .col-qty,
  .head-row .col-added {
    padding: var(--space-xs) 0;
  }

  .group-head {
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-tertiary);
  }

  .row {
    display: grid;
    grid-template-columns: 48px 1fr;
    align-items: stretch;
    border-bottom: 1px solid var(--color-border);
  }

  .row:last-child {
    border-bottom: none;
  }

  .row.selected {
    background-color: color-mix(in srgb, var(--color-primary) 14%, transparent);
  }

  .col-check {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .col-check input {
    width: 20px;
    height: 20px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  /* Clicking the row body opens the edit form */
  .row-body {
    display: grid;
    grid-template-columns: 1fr 4rem 7rem;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 56px;
    padding: var(--space-sm) var(--space-md) var(--space-sm) 0;
    border: none;
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .row-body:hover {
    background-color: var(--color-bg-secondary);
  }

  .col-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
  }

  .name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pill-mine {
    flex-shrink: 0;
    padding: 1px 0.4rem;
    border-radius: 999px;
    background-color: var(--color-secondary);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .notes {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-qty {
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary);
    font-size: 0.92rem;
  }

  .col-added {
    color: var(--color-text-tertiary);
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row.purchased .name {
    text-decoration: line-through;
    color: var(--color-text-tertiary);
  }

  .empty {
    padding: var(--space-xl);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .empty p {
    margin: 0;
  }

  /* Purchased section */
  .purchased-section {
    margin-top: var(--space-md);
  }

  .purchased-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 48px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }

  .purchased-toggle:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-tertiary);
  }

  .caret {
    display: inline-block;
    transition: transform 0.15s ease;
    font-size: 0.8rem;
  }

  .caret.open {
    transform: rotate(90deg);
  }

  .purchased-count {
    margin-left: auto;
    padding: 1px 0.5rem;
    border-radius: 999px;
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }

  .purchased-table {
    margin-top: var(--space-xs);
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
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.14);
  }

  .bulk-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .bulk-count {
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .bulk-clear {
    min-height: 44px;
    padding: 0 var(--space-xs);
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.88rem;
    cursor: pointer;
  }

  @media (max-width: 767px) {
    /* Table goes edge to edge; text content keeps its own inset below */
    main {
      padding: var(--space-lg) 0 6rem;
    }

    .page-header,
    .filter-bar,
    .chips,
    .error-message,
    .purchased-section {
      padding-left: var(--space-md);
      padding-right: var(--space-md);
    }

    /* Square off the edges that now meet the viewport */
    .table-wrapper {
      border-radius: 0;
      border-left: none;
      border-right: none;
    }

    .page-header {
      align-items: center;
    }

    .filter-caption {
      display: none;
    }

    .seg {
      font-size: 0.8rem;
      padding: 0 var(--space-xs);
      gap: 0.25rem;
    }

    /* Added-by drops off the row; it is still shown in the edit form */
    .head-row {
      grid-template-columns: 44px 1fr 3.5rem;
    }

    .head-row .col-added,
    .row-body .col-added {
      display: none;
    }

    .row {
      grid-template-columns: 44px 1fr;
    }

    .row-body {
      grid-template-columns: 1fr 3.5rem;
    }

    .bulk-bar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-sm);
    }

    .bulk-left {
      justify-content: space-between;
    }

    .bulk-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .bulk-actions :global(.btn) {
      width: 100%;
    }
  }
</style>
