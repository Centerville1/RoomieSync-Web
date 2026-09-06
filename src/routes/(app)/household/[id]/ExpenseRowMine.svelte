<script lang="ts">
  import { shareFor, isUnevenSplit } from '$lib/splits';
  import {
    formatCurrency,
    formatDate,
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
    onEdit
  }: {
    expense: Expense;
    members?: Member[];
    tags?: Tag[];
    currentUserId: string;
    onEdit?: (expense: Expense) => void;
  } = $props();

  const tag = $derived(expense.tagId ? tags.find((t) => t.id === expense.tagId) : undefined);

  const nameFor = $derived((userId: string) => {
    const m = members.find((x) => x.id === userId);
    return m ? getMemberDisplayName(m) : 'Unknown';
  });

  // Everyone but me. These are the people who owe me for this.
  const others = $derived(expense.splits.filter((s) => s.userId !== currentUserId));

  // Whether I am part of my own split. Creating an expense you are not in is
  // legitimate: you paid for something that was not for you.
  const inMySplit = $derived(expense.splits.some((s) => s.userId === currentUserId));

  // Same call shape as EditExpenseModal, deliberately. Passing the raw
  // split.amount instead of shareFor would classify legacy null-amount rows
  // differently here than in the edit form, so the same expense would read as
  // even in the list and open with pinned shares in the form.
  const uneven = $derived(
    isUnevenSplit(
      expense.amount,
      expense.splits.map((s) => ({ userId: s.userId, amount: shareFor(expense, s.userId) })),
      expense.creatorId
    )
  );

  const perPerson = $derived(
    others.map((s) => ({
      userId: s.userId,
      name: nameFor(s.userId),
      amount: shareFor(expense, s.userId),
      hasPaid: s.hasPaid,
      paidAt: s.paidAt
    }))
  );

  // Summed from the stored shares rather than taken as amount - myShare. Those
  // agree whenever the split adds up, and calculateSplits guarantees it does,
  // but a legacy row that predates per-split amounts need not, and the sum is
  // the honest number in that case.
  const totalOwedToMe = $derived(perPerson.reduce((sum, p) => sum + p.amount, 0));
  const outstanding = $derived(
    perPerson.filter((p) => !p.hasPaid).reduce((sum, p) => sum + p.amount, 0)
  );
  const unpaidCount = $derived(perPerson.filter((p) => !p.hasPaid).length);

  // One real stored share, never amount / splits.length. An even $10 split
  // three ways stores 3.34/3.33/3.33; dividing would print 3.33 for everyone
  // and quietly lose the creator's extra penny.
  const eachOwes = $derived(others.length > 0 ? shareFor(expense, others[0].userId) : 0);

  let expanded = $state(false);
</script>

<div
  class="row"
  class:tagged={!!tag}
  class:is-optional={expense.isOptional}
  style={tag ? `--tag-color: ${tag.color ?? '#6b7fff'}` : ''}
>
  <!-- Empty gutter matching the checkbox column on other rows, so the two
       content columns line up across both row types. -->
  <span class="col-check"></span>
  <button
    type="button"
    class="row-body"
    aria-label="Edit {expense.description}, {formatCurrency(expense.amount)}"
    onclick={() => onEdit?.(expense)}
  >
    <span class="col-mine">
      <span class="desc-line">
        <span class="desc">{expense.description}</span>
        {#if tag}
          <span class="pill tag-pill">{tag.name}</span>
        {/if}
        {#if expense.isOptional}
          <span class="badge optional-badge" title="Optional expense" aria-hidden="true">?</span>
        {/if}
      </span>
      <span class="meta">
        {formatDate(expense.createdAt)}
        {#if expense.dueDate}
          <span class="due">· Due {formatDueDate(expense.dueDate)}</span>
        {/if}
      </span>
      <span class="amount you-paid">{formatCurrency(expense.amount)}</span>
    </span>

    <span class="col-others">
      {#if others.length === 0}
        <span class="quiet">Just you on this one</span>
      {:else if outstanding === 0}
        <span class="settled">Everyone has paid you back</span>
      {:else if uneven}
        <span class="owed-line">
          {unpaidCount}
          {unpaidCount === 1 ? 'person owes' : 'people owe'} you a total of
        </span>
        <span class="owed-amount">{formatCurrency(outstanding)}</span>
      {:else}
        <span class="owed-line">
          {unpaidCount === others.length
            ? 'Each person owes you'
            : `${unpaidCount} of ${others.length} still owe you`}
        </span>
        <span class="owed-amount"
          >{formatCurrency(eachOwes)}{#if unpaidCount !== others.length}<span class="owed-each">
              each</span
            >{/if}</span
        >
      {/if}
      {#if !inMySplit}
        <span class="quiet">You owe nothing on this</span>
      {/if}
    </span>
  </button>

  <!-- Positioned into the Everyone Else column, where the text is short enough
       to leave room. A sibling of the row body, never nested inside it, so a
       tap can only ever hit one of them. -->
  {#if others.length > 0}
    <button
      type="button"
      class="expand-btn"
      aria-expanded={expanded}
      aria-controls="breakdown-{expense.id}"
      onclick={() => (expanded = !expanded)}
    >
      <span class="chevron" class:open={expanded} aria-hidden="true">⌄</span>
      <span>{expanded ? 'Hide details' : 'View details'}</span>
    </button>
  {/if}
</div>

{#if expanded}
  <div class="breakdown" id="breakdown-{expense.id}">
    {#each perPerson as p (p.userId)}
      <div class="breakdown-row">
        <span class="bd-name">{p.name}</span>
        {#if p.hasPaid}
          <span class="bd-paid">
            Paid you {formatCurrency(p.amount)}
            {#if p.paidAt}<span class="bd-when">{formatShortDateTime(p.paidAt)}</span>{/if}
          </span>
        {:else}
          <span class="bd-owes">Owes {formatCurrency(p.amount)}</span>
        {/if}
      </div>
    {/each}
    <div class="breakdown-total">
      <span>Total split</span>
      <span>{formatCurrency(totalOwedToMe)} of {formatCurrency(expense.amount)}</span>
    </div>
  </div>
{/if}

<style>
  .row {
    display: grid;
    /* Kept identical to ExpenseRowTheirs and the head row. Edit all three
       together or the columns drift out of alignment. */
    grid-template-columns: 44px 1fr;
    align-items: stretch;
    border-bottom: 1px solid var(--color-border);
  }

  .col-check {
    min-width: 44px;
  }

  .row {
    position: relative;
  }

  .row.tagged {
    box-shadow: inset 4px 0 0 var(--tag-color);
  }

  .row.is-optional {
    box-shadow: inset 3px 0 0 var(--color-secondary);
  }

  /* A type colour outranks the optional marker */
  .row.tagged.is-optional {
    box-shadow: inset 4px 0 0 var(--tag-color);
  }

  /* Room for the expand control that sits over the bottom of the cell */
  .row:has(.expand-btn) .col-others {
    padding-bottom: 26px;
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

  .row-body:hover {
    background-color: var(--color-bg-secondary);
  }

  .row-body:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -4px;
    border-radius: var(--radius-sm);
  }

  .col-mine,
  .col-others {
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* Without this a long description refuses to shrink and pushes the row
       wider than the viewport, which is the whole problem being fixed. */
    min-width: 0;
  }

  .col-others {
    align-items: flex-start;
    text-align: left;
  }

  .desc-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
  }

  .desc {
    color: var(--color-text-primary);
    font-size: 0.92rem;
    font-weight: 600;
    /* Wraps rather than truncating: the row grows, nothing is hidden */
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

  .badge {
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1;
    flex-shrink: 0;
  }

  .optional-badge {
    background-color: rgba(107, 127, 255, 0.18);
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

  .amount {
    font-size: 0.95rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .you-paid {
    color: var(--color-success);
  }

  .owed-line {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
  }

  .owed-amount {
    color: var(--color-text-primary);
    font-size: 0.9rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .owed-each {
    color: var(--color-text-tertiary);
    font-size: 0.7rem;
    font-weight: 500;
  }

  .settled {
    color: var(--color-success);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .quiet {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
  }

  /* Sits in the Everyone Else column, under that cell's text, so it reads as
     part of this row rather than as a divider between two of them.
     Absolutely positioned so it does not consume a grid column and break the
     alignment shared with the other row type. */
  .expand-btn {
    position: absolute;
    left: calc(44px + 11rem + var(--space-md));
    bottom: var(--space-sm);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
    padding: 0 var(--space-sm) 0 0;
    border: none;
    background: none;
    color: var(--color-primary);
    font-family: inherit;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
  }

  .expand-btn:hover {
    color: var(--color-text-primary);
  }

  .expand-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .chevron {
    display: inline-block;
    transition: transform 0.15s;
    font-size: 1rem;
    line-height: 1;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .breakdown {
    padding: var(--space-sm) var(--space-md) var(--space-sm) var(--space-lg);
    background-color: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
  }

  .breakdown-row,
  .breakdown-total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: 3px 0;
    font-size: 0.8rem;
  }

  .bd-name {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .bd-owes {
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
  }

  .bd-paid {
    color: var(--color-success);
    font-variant-numeric: tabular-nums;
  }

  .bd-when {
    margin-left: var(--space-xs);
    color: var(--color-text-tertiary);
    font-size: 0.72rem;
  }

  .breakdown-total {
    margin-top: 2px;
    padding-top: var(--space-xs);
    border-top: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
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

    .expand-btn {
      left: calc(40px + 5.5rem + var(--space-sm));
    }

    .desc {
      font-size: 0.86rem;
    }

    .amount,
    .owed-amount {
      font-size: 0.86rem;
    }
  }
</style>
