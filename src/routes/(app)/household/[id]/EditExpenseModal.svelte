<script lang="ts">
  import { calculateSplits, shareFor } from '$lib/splits';
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import SplitEditor from '$lib/components/SplitEditor.svelte';
  import { enhance } from '$app/forms';

  type ExpenseSplit = {
    userId: string;
    amount?: number | null;
    hasPaid: boolean;
    paidAt: Date | null;
  };

  type Expense = {
    id: string;
    description: string;
    amount: number;
    isOptional: boolean;
    tagId: string | null;
    creatorId: string;
    createdAt: Date;
    splits: ExpenseSplit[];
  };

  type Member = {
    id: string;
    name: string;
    displayName: string | null;
  };

  type Tag = { id: string; name: string; color: string | null };

  let {
    open = $bindable(false),
    expense = null,
    members = [],
    tags = []
  }: {
    open: boolean;
    expense: Expense | null;
    members: Member[];
    tags?: Tag[];
  } = $props();

  let description = $state('');
  let isOptional = $state(false);
  let tagId = $state('');
  let selectedMembers = $state<string[]>([]);
  // Per-person amounts, seeded from what the expense already stores so an
  // uneven split opens showing the real shares rather than an even guess.
  let overrides = $state<Record<string, number>>({});
  // Set false by the split editor while the pinned amounts cannot reconcile
  let splitValid = $state(true);

  // Get members excluding the expense creator (they're always included)
  let otherMembers = $derived(members.filter((m) => m.id !== expense?.creatorId));

  // The payer row names the creator, who is not necessarily the person editing
  let creatorLabel = $derived.by(() => {
    const creator = members.find((m) => m.id === expense?.creatorId);
    return creator ? getMemberDisplayName(creator) : 'Paid by';
  });

  // Track the original split member IDs when expense is loaded
  let originalSplitMemberIds = $state<string[]>([]);

  // Update form state when expense changes
  $effect(() => {
    if (expense) {
      description = expense.description;
      isOptional = expense.isOptional;
      tagId = expense.tagId ?? '';
      // Initialize selected members from current splits (excluding creator)
      const splitMemberIds = expense.splits
        .filter((s) => s.userId !== expense.creatorId)
        .map((s) => s.userId);
      selectedMembers = splitMemberIds;
      originalSplitMemberIds = splitMemberIds;

      // Pin the current shares only when the expense is actually uneven, so an
      // edit cannot quietly flatten a 600/700 rent back to an even split. An
      // evenly split expense is left unpinned: pinning it would leave nothing
      // to absorb a newly added member, landing them on zero.
      const evenShare = expense.amount / expense.splits.length;
      const isUneven = expense.splits.some(
        (sp) => Math.abs(shareFor(expense, sp.userId) - evenShare) > 0.005
      );

      const seeded: Record<string, number> = {};
      if (isUneven) {
        for (const sp of expense.splits) {
          seeded[sp.userId] = shareFor(expense, sp.userId);
        }
      }
      overrides = seeded;
    }
  });

  // What each person owes now, straight from the stored splits.
  let originalShares = $derived.by(() => {
    const map = new Map<string, number>();
    if (!expense) return map;
    for (const sp of expense.splits) map.set(sp.userId, shareFor(expense, sp.userId));
    return map;
  });

  // What each person would owe once this edit is saved. Mirrors the server:
  // pinned amounts are honoured, anything else divides what is left.
  let newShares = $derived.by(() => {
    const map = new Map<string, number>();
    if (!expense) return map;
    const participants = [...new Set([expense.creatorId, ...selectedMembers])];
    const evenShare = expense.amount / participants.length;
    const result = calculateSplits(
      expense.amount,
      participants.map((userId) => {
        const p = overrides[userId];
        const isOverride = p !== undefined && Math.abs(p - evenShare) > 0.005;
        return { userId, override: isOverride ? p : undefined };
      }),
      expense.creatorId
    );
    for (const r of result) map.set(r.userId, r.amount);
    return map;
  });

  // Changed if the membership moved or if anyone's amount did: editing only
  // the amounts still needs settling with whoever already paid.
  let splitsChanged = $derived(() => {
    if (originalSplitMemberIds.length !== selectedMembers.length) return true;
    const originalSet = new Set(originalSplitMemberIds);
    if (selectedMembers.some((id) => !originalSet.has(id))) return true;
    for (const [userId, before] of originalShares) {
      const after = newShares.get(userId);
      if (after === undefined || Math.abs(after - before) > 0.005) return true;
    }
    return false;
  });

  // Get members who have already paid
  let paidMembers = $derived(
    expense
      ? expense.splits
          .filter((s) => s.hasPaid && s.userId !== expense.creatorId)
          .map((s) => {
            const member = members.find((m) => m.id === s.userId);
            return {
              userId: s.userId,
              name: member ? getMemberDisplayName(member) : 'Unknown',
              paidAt: s.paidAt
            };
          })
      : []
  );

  // Calculate refunds/requests needed for paid members based on split changes
  let settlementActions = $derived(() => {
    if (!expense || !splitsChanged()) return [];

    const actions: Array<{
      userId: string;
      name: string;
      type: 'refund' | 'request';
      amount: number;
      wasRemoved: boolean;
    }> = [];

    // Each person is settled against their own before and after amounts, which
    // differ per person once a split is uneven.
    for (const paidMember of paidMembers) {
      const isStillIncluded = selectedMembers.includes(paidMember.userId);
      const before = originalShares.get(paidMember.userId) ?? 0;

      if (!isStillIncluded) {
        // Member was removed - refund what they actually paid
        actions.push({
          userId: paidMember.userId,
          name: paidMember.name,
          type: 'refund',
          amount: before,
          wasRemoved: true
        });
        continue;
      }

      const difference = (newShares.get(paidMember.userId) ?? 0) - before;
      if (Math.abs(difference) <= 0.005) continue;

      actions.push({
        userId: paidMember.userId,
        name: paidMember.name,
        type: difference > 0 ? 'request' : 'refund',
        amount: Math.abs(difference),
        wasRemoved: false
      });
    }

    return actions;
  });

  // Everyone whose amount moves, for the change summary. Covers people who are
  // not part of the settlement list too, since they may owe more without having
  // paid anything yet.
  let changedShares = $derived.by(() => {
    if (!expense) return [];
    const rows: Array<{
      userId: string;
      name: string;
      before: number;
      after: number;
      difference: number;
      wasRemoved: boolean;
    }> = [];
    const everyone = new Set([...originalShares.keys(), ...newShares.keys()]);
    for (const userId of everyone) {
      const before = originalShares.get(userId) ?? 0;
      const wasRemoved = !newShares.has(userId);
      const after = newShares.get(userId) ?? 0;
      const difference = after - before;
      if (!wasRemoved && Math.abs(difference) <= 0.005) continue;
      const member = members.find((m) => m.id === userId);
      rows.push({
        userId,
        name:
          userId === expense.creatorId
            ? creatorLabel
            : member
              ? getMemberDisplayName(member)
              : 'Unknown',
        before,
        after,
        difference,
        wasRemoved
      });
    }
    return rows;
  });

  // Check if there are any settlement actions needed
  let hasSettlementActions = $derived(settlementActions().length > 0);

  // Calculate totals
  let totalRefunds = $derived(
    settlementActions()
      .filter((a) => a.type === 'refund')
      .reduce((sum, a) => sum + a.amount, 0)
  );
  let totalRequests = $derived(
    settlementActions()
      .filter((a) => a.type === 'request')
      .reduce((sum, a) => sum + a.amount, 0)
  );

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function getMemberDisplayName(member: Member) {
    return member.displayName || member.name;
  }

  function handleClose() {
    open = false;
    selectedMembers = [];
    originalSplitMemberIds = [];
    overrides = {};
    splitValid = true;
  }
</script>

<Modal bind:open title="Edit Expense" size="md">
  {#snippet children()}
    {#if expense}
      <form
        method="POST"
        action="?/editExpense"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
            handleClose();
          };
        }}
        id="edit-expense-form"
      >
        <input type="hidden" name="expenseId" value={expense.id} />

        <div class="form-group">
          <Textarea
            name="description"
            label="Description"
            placeholder="What's this expense for?"
            required
            rows={3}
            bind:value={description}
          />
        </div>

        <div class="expense-details">
          <span class="detail-label">Amount:</span>
          <span class="detail-value">
            {formatCurrency(expense.amount)}
          </span>
        </div>

        <div class="form-group split-section">
          <SplitEditor
            members={otherMembers}
            bind:selectedMembers
            bind:overrides
            bind:valid={splitValid}
            total={expense.amount}
            payerId={expense.creatorId}
            payerLabel={creatorLabel}
            initializeAll={false}
          >
            {#snippet memberExtra({ member, isChecked })}
              {@const existingSplit = expense?.splits.find((s) => s.userId === member.id)}
              {@const hasPaid = existingSplit?.hasPaid ?? false}
              {#if hasPaid}
                <span class="paid-badge" class:removed={!isChecked}>
                  {isChecked ? 'Paid' : 'Paid (removing)'}
                </span>
              {/if}
            {/snippet}
          </SplitEditor>
        </div>

        {#if tags.length > 0}
          <div class="form-group">
            <label for="edit-expense-tag" class="tag-label">Type (optional)</label>
            <select bind:value={tagId} name="tagId" id="edit-expense-tag">
              <option value="">No tag</option>
              {#each tags as t (t.id)}
                <option value={t.id}>{t.name}</option>
              {/each}
            </select>
            <p class="tag-help">
              Marks the expense as important and flags it for all household members.
            </p>
          </div>
        {:else}
          <!-- No tags defined, but the field must still post: editExpense reads a
               missing tagId as "clear the tag". -->
          <input type="hidden" name="tagId" value={tagId} />
        {/if}

        <div class="form-group">
          <Checkbox
            name="isOptional"
            bind:checked={isOptional}
            label="Optional expense (people can choose to pay)"
          />
        </div>

        <!-- Who moves, and by how much. Listed per person because an uneven
             split has no single "share per person" to quote. -->
        {#if splitsChanged()}
          <div class="share-change-info">
            {#each changedShares as row (row.userId)}
              <div class="share-row">
                <span class="share-label">{row.name}</span>
                <span
                  class="share-value"
                  class:increased={row.difference > 0}
                  class:decreased={row.difference < 0}
                >
                  {#if row.wasRemoved}
                    <span class="share-was">{formatCurrency(row.before)}</span>
                    removed
                  {:else}
                    {#if row.difference !== 0}
                      <span class="share-was">{formatCurrency(row.before)}</span>
                    {/if}
                    {formatCurrency(row.after)}
                    {#if row.difference !== 0}
                      <span class="share-diff">
                        ({row.difference > 0 ? '+' : ''}{formatCurrency(row.difference)})
                      </span>
                    {/if}
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Settlement warning and actions -->
        {#if hasSettlementActions}
          <div class="settlement-warning">
            <div class="warning-header">
              <span class="warning-icon">⚠️</span>
              <span class="warning-title">Settlement Required</span>
            </div>
            <p class="warning-text">
              Some members have already paid. Changing the split requires you to settle up outside
              of this app. These transactions won't be tracked in RoomieSync.
            </p>
          </div>

          <div class="settlement-section">
            <h3 class="settlement-title">Required Actions</h3>

            <div class="settlement-list">
              {#each settlementActions() as action}
                <div
                  class="settlement-item"
                  class:refund={action.type === 'refund'}
                  class:request={action.type === 'request'}
                >
                  <div class="settlement-info">
                    <span class="settlement-action-type">
                      {action.type === 'refund' ? 'Refund' : 'Request from'}
                    </span>
                    <span class="settlement-name">{action.name}</span>
                    {#if action.wasRemoved}
                      <span class="settlement-reason">(removed from split)</span>
                    {:else}
                      <span class="settlement-reason"
                        >(share {action.type === 'refund' ? 'decreased' : 'increased'})</span
                      >
                    {/if}
                  </div>
                  <span
                    class="settlement-amount"
                    class:refund={action.type === 'refund'}
                    class:request={action.type === 'request'}
                  >
                    {action.type === 'refund' ? '-' : '+'}{formatCurrency(action.amount)}
                  </span>
                </div>
              {/each}
            </div>

            {#if totalRefunds > 0 || totalRequests > 0}
              <div class="settlement-totals">
                {#if totalRefunds > 0}
                  <div class="settlement-total refund">
                    <span class="total-label">Total to Refund:</span>
                    <span class="total-amount">{formatCurrency(totalRefunds)}</span>
                  </div>
                {/if}
                {#if totalRequests > 0}
                  <div class="settlement-total request">
                    <span class="total-label">Total to Request:</span>
                    <span class="total-amount">{formatCurrency(totalRequests)}</span>
                  </div>
                {/if}
              </div>
            {/if}

            <div class="settlement-instructions">
              <p class="instructions-text">
                Please send refunds or request additional payments via your preferred method (Venmo,
                Zelle, etc.) before or after saving these changes.
              </p>
            </div>
          </div>
        {/if}
      </form>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Cancel</Button>
    <Button
      type="submit"
      variant={hasSettlementActions ? 'danger' : 'primary'}
      form="edit-expense-form"
      disabled={!splitValid}
    >
      {hasSettlementActions ? 'Save Changes (Settlement Required)' : 'Save Changes'}
    </Button>
  {/snippet}
</Modal>

<style>
  .tag-label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  select {
    width: 100%;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    min-height: 44px;
    padding: 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
  }

  select:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  .tag-help {
    margin: var(--space-xs) 0 0;
    color: var(--color-text-tertiary);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .form-group {
    margin-bottom: var(--space-lg);
  }

  .expense-details {
    display: flex;
    justify-content: space-between;
    padding: var(--space-sm);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    margin-bottom: var(--space-lg);
  }

  .detail-label {
    color: var(--color-text-secondary);
  }

  .detail-value {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .split-section {
    margin-top: var(--space-md);
  }

  .paid-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background-color: var(--color-success-subtle);
    color: var(--color-success);
    border-radius: var(--radius-sm);
    font-weight: 500;
  }

  .paid-badge.removed {
    background-color: var(--color-warning-subtle, rgba(245, 158, 11, 0.1));
    color: var(--color-warning, #f59e0b);
  }

  /* Share change info */
  .share-change-info {
    margin-top: var(--space-lg);
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .share-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .share-label {
    color: var(--color-text-secondary);
  }

  .share-value {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .share-value.increased {
    color: var(--color-error, #ef4444);
  }

  .share-value.decreased {
    color: var(--color-success, #22c55e);
  }

  .share-was {
    margin-right: var(--space-xs);
    color: var(--color-text-tertiary);
    text-decoration: line-through;
    font-weight: 400;
  }

  .share-diff {
    font-size: 0.75rem;
    margin-left: var(--space-xs);
  }

  /* Settlement warning */
  .settlement-warning {
    margin-top: var(--space-lg);
    padding: var(--space-md);
    background-color: var(--color-warning-subtle, rgba(245, 158, 11, 0.1));
    border: 1px solid var(--color-warning, #f59e0b);
    border-radius: var(--radius-md);
  }

  .warning-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .warning-icon {
    font-size: 1.25rem;
  }

  .warning-title {
    font-weight: 600;
    color: var(--color-warning, #f59e0b);
  }

  .warning-text {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  /* Settlement section */
  .settlement-section {
    margin-top: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .settlement-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .settlement-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .settlement-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
  }

  .settlement-item:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  .settlement-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .settlement-action-type {
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.025em;
  }

  .settlement-item.refund .settlement-action-type {
    color: var(--color-success, #22c55e);
  }

  .settlement-item.request .settlement-action-type {
    color: var(--color-error, #ef4444);
  }

  .settlement-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .settlement-reason {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .settlement-amount {
    font-weight: 600;
    font-size: 1rem;
  }

  .settlement-amount.refund {
    color: var(--color-success, #22c55e);
  }

  .settlement-amount.request {
    color: var(--color-error, #ef4444);
  }

  /* Settlement totals */
  .settlement-totals {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
  }

  .settlement-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .total-label {
    color: var(--color-text-secondary);
  }

  .settlement-total.refund .total-amount {
    font-weight: 600;
    color: var(--color-success, #22c55e);
  }

  .settlement-total.request .total-amount {
    font-weight: 600;
    color: var(--color-error, #ef4444);
  }

  /* Settlement instructions */
  .settlement-instructions {
    padding: var(--space-md);
    background-color: var(--color-primary-subtle, rgba(107, 127, 255, 0.1));
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-md);
  }

  .instructions-text {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-primary);
    text-align: center;
    line-height: 1.5;
  }
</style>
