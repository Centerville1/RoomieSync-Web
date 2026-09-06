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
  <!-- Two sibling buttons, never nested: the left cell edits, the right cell
       expands. A tap can only ever land in one of them. The edit half also
       covers the checkbox gutter, which is empty on my own rows, so no part
       of the row is dead space. -->
  <button
    type="button"
    class="row-body edit-part"
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
  </button>

  {#snippet owedSummary()}
    {#if others.length === 0}
      <span class="quiet">Just you on this one</span>
    {:else if outstanding === 0}
      <span class="settled">
        <span class="badge paid-badge" aria-hidden="true">✓</span>
        Everyone paid you back
      </span>
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
  {/snippet}

  {#if others.length > 0}
    <!-- The whole cell is the expand target, so the small "View details" link
         is a label rather than the only thing you can hit. -->
    <button
      type="button"
      class="row-body expand-part"
      aria-expanded={expanded}
      aria-controls="breakdown-{expense.id}"
      onclick={() => (expanded = !expanded)}
    >
      <span class="col-others">
        {@render owedSummary()}
        <span class="expand-link">
          <span class="chevron" class:open={expanded} aria-hidden="true">⌄</span>
          {expanded ? 'Hide details' : 'View details'}
        </span>
      </span>
    </button>
  {:else}
    <div class="row-body static">
      <span class="col-others">{@render owedSummary()}</span>
    </div>
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
    /* Gutter, then the two halves. Their widths must stay identical to
       ExpenseRowTheirs and the head row, or the columns drift apart. */
    grid-template-columns: 44px 11rem minmax(0, 1fr);
    align-items: stretch;
    border-bottom: 1px solid var(--color-border);
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

  /* Each half is its own button now, so the row grid places them rather than
     an inner grid. The gap lives as padding so the two targets stay adjacent
     with no dead strip between them. */
  .row-body {
    display: block;
    width: 100%;
    min-width: 0;
    min-height: 60px;
    border: none;
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .edit-part {
    /* Spans the gutter, with padding that keeps the text on the same grid
       line as rows that do carry a checkbox. */
    grid-column: 1 / 3;
    padding: var(--space-sm) 0 var(--space-sm) 44px;
  }

  /* The full inter-column gap sits here, matching ExpenseRowTheirs, whose
     grid puts its whole gap before the second column. Split it across both
     halves and the two row types land 8px apart. */
  .expand-part {
    padding: var(--space-sm) var(--space-md) var(--space-sm) calc(var(--space-sm) * 2);
  }

  .row-body.static {
    cursor: default;
    padding: var(--space-sm) var(--space-md) var(--space-sm) calc(var(--space-sm) * 2);
  }

  .expand-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    color: var(--color-primary);
    font-size: 0.76rem;
    font-weight: 700;
  }

  /* Keyboard only, and deliberately quiet: pointer users get no ring, and
     the brand orange was far too loud for a whole-row outline. */
  .row-body:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 45%, transparent);
    outline-offset: -3px;
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
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-success);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .paid-badge {
    background-color: rgba(34, 197, 94, 0.18);
    color: var(--color-success);
  }

  .quiet {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
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
      grid-template-columns: 40px 5.5rem minmax(0, 1fr);
    }

    .edit-part {
      padding-left: 40px;
    }

    .expand-part,
    .row-body.static {
      padding-right: var(--space-sm);
      /* Matches the mobile gap in ExpenseRowTheirs */
      padding-left: var(--space-sm);
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
