<script lang="ts">
  import { shareFor } from '$lib/splits';
  import {
    formatCurrency,
    formatDateTime,
    formatDueDate,
    formatShortDateTime,
    getMemberDisplayName
  } from './expense-format';

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
    expense,
    members = [],
    tags = [],
    currentUserId,
    isSelected = false,
    onToggleSelect,
    onCancelPayment
  }: {
    expense: Expense;
    members?: Member[];
    tags?: Tag[];
    currentUserId: string;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    onCancelPayment?: (expense: Expense) => void;
  } = $props();

  const tag = $derived(expense.tagId ? tags.find((t) => t.id === expense.tagId) : undefined);

  const creatorName = $derived.by(() => {
    // Resolved through members, not expense.creator: the joined creator object
    // carries no displayName, so a household nickname would be lost.
    const m = members.find((x) => x.id === expense.creatorId);
    return m ? getMemberDisplayName(m) : 'Unknown';
  });

  const mySplit = $derived(expense.splits.find((s) => s.userId === currentUserId));
  const myShare = $derived(shareFor(expense, currentUserId));
  const inSplit = $derived(mySplit !== undefined);

  // Optional expenses stay selectable: you may choose to pay them. Excluding
  // them here would quietly remove the only way to do that.
  const isSelectable = $derived(inSplit && !mySplit?.hasPaid);
</script>

<div
  class="row"
  class:selected={isSelected}
  class:tagged={!!tag}
  class:not-mine={!inSplit}
  style={tag ? `--tag-color: ${tag.color ?? '#6b7fff'}` : ''}
>
  {#if isSelectable}
    <label class="col-check">
      <input
        type="checkbox"
        checked={isSelected}
        onchange={() => onToggleSelect?.(expense.id)}
        aria-label="Select {expense.description} from {creatorName}, you owe {formatCurrency(
          myShare
        )}"
      />
    </label>
  {:else}
    <span class="col-check"></span>
  {/if}

  {#snippet body()}
    <span class="col-mine">
      {#if !inSplit}
        <span class="quiet">Not your split</span>
        <span class="quiet-amount">You owe nothing</span>
      {:else if mySplit?.hasPaid}
        <span class="paid-label">You paid</span>
        <span class="amount paid">{formatCurrency(myShare)}</span>
        {#if mySplit.paidAt}
          <span class="meta">{formatShortDateTime(mySplit.paidAt)}</span>
        {/if}
      {:else}
        <span class="owe-label">You owe</span>
        <span class="amount owe" class:optional={expense.isOptional}>
          {formatCurrency(myShare)}
        </span>
        {#if expense.isOptional}
          <span class="pill optional-pill">Optional</span>
        {/if}
      {/if}
    </span>

    <span class="col-others">
      <span class="creator">{creatorName}</span>
      <span class="desc-line">
        <span class="desc">{expense.description}</span>
        {#if tag}
          <span class="pill tag-pill">{tag.name}</span>
        {/if}
      </span>
      <span class="meta">
        {formatDateTime(expense.createdAt)}
        {#if expense.dueDate}
          <span class="due">· Due {formatDueDate(expense.dueDate)}</span>
        {/if}
      </span>
      <span class="amount total">{formatCurrency(expense.amount)}</span>
    </span>
  {/snippet}

  {#if isSelectable}
    <button
      type="button"
      class="row-body"
      aria-pressed={isSelected}
      onclick={() => onToggleSelect?.(expense.id)}
    >
      {@render body()}
    </button>
  {:else if mySplit?.hasPaid && onCancelPayment}
    <!-- Already settled, so the row is not a selection target. Its one action
         is undoing the payment, which is what the button does. -->
    <button
      type="button"
      class="row-body"
      aria-label="Undo your payment of {formatCurrency(myShare)} for {expense.description}"
      onclick={() => onCancelPayment(expense)}
    >
      {@render body()}
      <span class="undo-hint">Undo</span>
    </button>
  {:else}
    <!-- Nothing to do on this row, so it must not be focusable -->
    <div class="row-body static">
      {@render body()}
    </div>
  {/if}
</div>

<style>
  .row {
    display: grid;
    /* Matches ExpenseRowMine and the head row; edit all three together. */
    grid-template-columns: 44px 1fr;
    align-items: stretch;
    border-bottom: 1px solid var(--color-border);
  }

  .row.tagged {
    box-shadow: inset 4px 0 0 var(--tag-color);
  }

  .row.selected {
    background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  .row.not-mine {
    opacity: 0.72;
  }

  .col-check {
    display: grid;
    place-items: center;
    min-width: 44px;
  }

  .col-check input {
    width: 20px;
    height: 20px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .row-body {
    display: grid;
    /* The right column takes the slack. A 1fr/1fr split on a wide screen
       pushed the two halves to opposite edges with a dead gulf between them,
       so a row read as two unrelated things. */
    grid-template-columns: 11rem minmax(0, 1fr);
    gap: var(--space-md);
    width: 100%;
    min-width: 0;
    min-height: 60px;
    padding: var(--space-sm) var(--space-md) var(--space-sm) 0;
    border: none;
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .row-body.static {
    cursor: default;
  }

  .row-body:not(.static):hover {
    background-color: var(--color-bg-secondary);
  }

  .row-body:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .col-mine,
  .col-others {
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* Lets a long description shrink instead of widening the page */
    min-width: 0;
  }

  .col-others {
    align-items: flex-start;
    text-align: left;
  }

  .creator {
    color: var(--color-text-primary);
    font-size: 0.82rem;
    font-weight: 700;
  }

  .desc-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
  }

  .desc {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    /* Wraps in full rather than truncating */
    overflow-wrap: anywhere;
  }

  .pill {
    flex-shrink: 0;
    padding: 1px 0.4rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
  }

  .tag-pill {
    border: 1px solid var(--tag-color);
    background-color: color-mix(in srgb, var(--tag-color) 18%, transparent);
    color: var(--color-text-primary);
  }

  .optional-pill {
    align-self: flex-start;
    background-color: color-mix(in srgb, var(--color-secondary) 18%, transparent);
    color: var(--color-secondary);
  }

  .meta {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
  }

  .due {
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .owe-label,
  .paid-label {
    color: var(--color-text-secondary);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .amount {
    font-size: 0.95rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .amount.owe {
    color: var(--color-error);
  }

  .amount.owe.optional {
    color: var(--color-secondary);
  }

  .amount.paid {
    color: var(--color-success);
  }

  .amount.total {
    color: var(--color-error);
  }

  .quiet {
    color: var(--color-text-tertiary);
    font-size: 0.72rem;
  }

  .quiet-amount {
    color: var(--color-text-tertiary);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .undo-hint {
    position: absolute;
    right: var(--space-md);
    bottom: 4px;
    color: var(--color-text-tertiary);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .row-body {
    position: relative;
  }

  @media (max-width: 767px) {
    .row {
      grid-template-columns: 40px 1fr;
    }

    .col-check {
      min-width: 40px;
    }

    .row-body {
      padding-right: var(--space-sm);
      gap: var(--space-sm);
      grid-template-columns: 5.5rem minmax(0, 1fr);
    }

    .amount {
      font-size: 0.86rem;
    }

    .desc {
      font-size: 0.8rem;
    }
  }
</style>
