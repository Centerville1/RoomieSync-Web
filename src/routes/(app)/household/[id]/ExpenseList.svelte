<script lang="ts">
  import ExpenseRowMine from './ExpenseRowMine.svelte';
  import ExpenseRowTheirs from './ExpenseRowTheirs.svelte';

  type Member = { id: string; name: string; displayName: string | null };
  type Split = { userId: string; amount: number | null; hasPaid: boolean; paidAt: Date | null };
  type Expense = {
    id: string;
    description: string;
    amount: number;
    isOptional: boolean;
    tagId: string | null;
    dueDate: string | null;
    creatorId: string;
    createdAt: Date;
    splits: Split[];
  };
  type Tag = { id: string; name: string; color: string | null };

  let {
    members = [],
    expenses = [],
    tags = [],
    currentUserId,
    selectedExpenseIds = new Set<string>(),
    onSelectionChange,
    /**
     * Every expense the user owes on, across all pages. The list only holds the
     * loaded page, so select-all has to come from the page or it silently stops
     * covering expenses that have not been scrolled to yet.
     */
    allSelectableIds = new Set<string>(),
    onEditExpense,
    onCancelPayment,
    onLoadMore,
    hasMore = false,
    isAdmin = false,
    onImportExpense
  }: {
    members?: Member[];
    expenses?: Expense[];
    tags?: Tag[];
    currentUserId: string;
    selectedExpenseIds?: Set<string>;
    onSelectionChange?: (ids: Set<string>) => void;
    allSelectableIds?: Set<string>;
    onEditExpense?: (expense: Expense) => void;
    onCancelPayment?: (expense: Expense) => void;
    onLoadMore?: () => Promise<void>;
    hasMore?: boolean;
    isAdmin?: boolean;
    /** Adds a historic expense: part of the list, since that is what it adds to. */
    onImportExpense?: () => void;
  } = $props();

  function toggleSelected(id: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedExpenseIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  const allSelected = $derived(
    allSelectableIds.size > 0 && [...allSelectableIds].every((id) => selectedExpenseIds.has(id))
  );

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(allSelectableIds));
  }

  // Paging. An observer on a sentinel after the last row, rather than a scroll
  // listener: the list no longer has its own scroll box, and this does not fire
  // on every frame.
  let sentinel = $state<HTMLDivElement | null>(null);
  let isLoadingMore = $state(false);

  // Measured, not assumed: the head row's min-height is a floor, and the
  // select-all label can push it taller on a narrow screen. The import row
  // sticks directly beneath it, so a wrong number here would overlap.
  let headRowHeight = $state(0);

  $effect(() => {
    if (!sentinel || !onLoadMore || !hasMore) return;
    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || isLoadingMore) return;
        isLoadingMore = true;
        try {
          await onLoadMore();
        } finally {
          isLoadingMore = false;
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

<div class="expense-list">
  <div class="head-row" bind:clientHeight={headRowHeight}>
    <span class="col-check"></span>
    <span class="head-label">Mine</span>
    <span class="head-label">Everyone Else</span>
    <span class="head-label detail">Who Owes You</span>
    <!-- Right-aligned and labelled: sitting in the checkbox gutter beside
         "Mine" read as though it selected that column. -->
    {#if allSelectableIds.size > 0 && onSelectionChange}
      <label class="select-all">
        <span>Select All</span>
        <input
          type="checkbox"
          checked={allSelected}
          onchange={toggleSelectAll}
          aria-label={allSelected
            ? 'Clear selection'
            : `Select all ${allSelectableIds.size} expenses you owe on`}
        />
      </label>
    {/if}
  </div>

  <!-- Above the first row, not below the last: at the foot of a list this long
       nobody would ever scroll to it. Sticks directly under the head row. -->
  {#if isAdmin && onImportExpense}
    <button
      type="button"
      class="import-row"
      style="--head-row-height: {headRowHeight}px"
      onclick={() => onImportExpense()}
    >
      <span class="import-plus" aria-hidden="true">+</span>
      Import an expense
    </button>
  {/if}

  {#if expenses.length === 0}
    <p class="empty">No expenses yet. Split the cost of something to get started.</p>
  {:else}
    <!-- Keyed, so paging in more rows does not reset expansion state or let
         checkbox DOM state drift from selectedExpenseIds. -->
    {#each expenses as expense (expense.id)}
      {#if expense.creatorId === currentUserId}
        <ExpenseRowMine {expense} {members} {tags} {currentUserId} onEdit={onEditExpense} />
      {:else}
        <ExpenseRowTheirs
          {expense}
          {members}
          {tags}
          {currentUserId}
          isSelected={selectedExpenseIds.has(expense.id)}
          onToggleSelect={toggleSelected}
          {onCancelPayment}
        />
      {/if}
    {/each}
  {/if}

  {#if hasMore}
    <div class="sentinel" bind:this={sentinel}>
      {#if isLoadingMore}<span class="loading">Loading more…</span>{/if}
    </div>
  {/if}
</div>

<style>
  .expense-list {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: var(--color-bg-primary);
    /* Deliberately no overflow-x: anything too wide should visibly break so it
       gets fixed, rather than hiding behind a scrollbar. `overflow: hidden`
       would also trap the sticky header below, so the corners are clipped by
       the rows themselves instead. */
  }

  /* Sticks below the household header, whose height it reads rather than
     guessing: that height changes with the breakpoint and with whether the
     household has a banner. */
  .head-row {
    position: sticky;
    top: calc(var(--navbar-height, 5.5rem) + var(--household-header-height, 0px));
    z-index: 30;
    display: grid;
    /* The row components' own tracks, not a nested grid inside a 1fr: nesting
       computed different widths and left every label off its column. The
       trailing auto slot holds select-all. */
    grid-template-columns: 44px 11rem minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    min-height: 40px;
    background-color: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-lg);
  }

  .col-check {
    display: grid;
    place-items: center;
    min-width: 44px;
  }

  /* Each column's content starts inside its track, so the labels carry the
     same left padding as the cells they head. */
  .head-label:nth-of-type(2) {
    padding-left: calc(var(--space-sm) * 2);
  }

  .head-label.detail {
    padding-left: var(--space-md);
  }

  @media (max-width: 1099px) {
    .head-row {
      grid-template-columns: 44px 11rem minmax(0, 1fr);
    }

    .head-label.detail {
      display: none;
    }
  }

  .head-label {
    color: var(--color-text-secondary);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .select-all {
    /* In the last track rather than a track of its own: an auto track would
       narrow the flexible ones and the labels would stop matching the rows. */
    grid-column: -2;
    justify-self: end;
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    min-height: 34px;
    padding: 0 var(--space-md) 0 var(--space-sm);
    color: var(--color-text-secondary);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    white-space: nowrap;
  }

  .select-all input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .import-row {
    /* Stacks under the sticky head row, so both stay reachable while the list
       scrolls. z-index is one below the head row's, so the head row wins where
       they meet. */
    position: sticky;
    top: calc(
      var(--navbar-height, 5.5rem) + var(--household-header-height, 0px) +
        var(--head-row-height, 40px)
    );
    z-index: 29;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    width: 100%;
    min-height: 40px;
    border: none;
    border-bottom: 1px solid var(--color-border);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .import-row:hover {
    color: var(--color-text-primary);
  }

  .import-plus {
    font-size: 1rem;
    line-height: 1;
  }

  .empty {
    margin: 0;
    padding: var(--space-xl) var(--space-md);
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .sentinel {
    display: grid;
    place-items: center;
    min-height: 40px;
  }

  .loading {
    color: var(--color-text-tertiary);
    font-size: 0.8rem;
  }

  @media (max-width: 767px) {
    .expense-list {
      border-radius: 0;
      border-left: none;
      border-right: none;
    }

    .head-row {
      border-radius: 0;
    }

    .head-row {
      grid-template-columns: 40px 5.5rem minmax(0, 1fr);
    }

    .head-label:nth-of-type(2) {
      padding-left: var(--space-sm);
    }

    .select-all {
      padding-right: var(--space-sm);
      font-size: 0.68rem;
    }

    .col-check {
      min-width: 40px;
    }
  }
</style>
