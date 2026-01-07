<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import MemberSelect from '$lib/components/MemberSelect.svelte';
  import { enhance } from '$app/forms';

  type ExpenseSplit = {
    userId: string;
    hasPaid: boolean;
    paidAt: Date | null;
  };

  type Expense = {
    id: string;
    description: string;
    amount: number;
    isOptional: boolean;
    creatorId: string;
    createdAt: Date;
    splits: ExpenseSplit[];
  };

  type Member = {
    id: string;
    name: string;
    displayName: string | null;
  };

  let {
    open = $bindable(false),
    expense = null,
    members = []
  }: {
    open: boolean;
    expense: Expense | null;
    members: Member[];
  } = $props();

  let description = $state('');
  let isOptional = $state(false);
  let selectedMembers = $state<string[]>([]);

  // Get members excluding the expense creator (they're always included)
  let otherMembers = $derived(members.filter((m) => m.id !== expense?.creatorId));

  // Track the original split member IDs when expense is loaded
  let originalSplitMemberIds = $state<string[]>([]);

  // Update form state when expense changes
  $effect(() => {
    if (expense) {
      description = expense.description;
      isOptional = expense.isOptional;
      // Initialize selected members from current splits (excluding creator)
      const splitMemberIds = expense.splits
        .filter((s) => s.userId !== expense.creatorId)
        .map((s) => s.userId);
      selectedMembers = splitMemberIds;
      originalSplitMemberIds = splitMemberIds;
    }
  });

  // Calculate the original and new split counts (including creator)
  let originalSplitCount = $derived(originalSplitMemberIds.length + 1);
  let newSplitCount = $derived(selectedMembers.length + 1);

  // Calculate shares
  let originalShare = $derived(expense ? expense.amount / originalSplitCount : 0);
  let newShare = $derived(expense ? expense.amount / newSplitCount : 0);
  let shareDifference = $derived(newShare - originalShare);

  // Check if splits have changed
  let splitsChanged = $derived(() => {
    if (originalSplitMemberIds.length !== selectedMembers.length) return true;
    const originalSet = new Set(originalSplitMemberIds);
    return selectedMembers.some((id) => !originalSet.has(id));
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

    for (const paidMember of paidMembers) {
      const isStillIncluded = selectedMembers.includes(paidMember.userId);

      if (!isStillIncluded) {
        // Member was removed - refund their entire original share
        actions.push({
          userId: paidMember.userId,
          name: paidMember.name,
          type: 'refund',
          amount: originalShare,
          wasRemoved: true
        });
      } else if (shareDifference !== 0) {
        // Member still included but share changed
        if (shareDifference > 0) {
          // Share increased - request more money
          actions.push({
            userId: paidMember.userId,
            name: paidMember.name,
            type: 'request',
            amount: shareDifference,
            wasRemoved: false
          });
        } else {
          // Share decreased - refund the difference
          actions.push({
            userId: paidMember.userId,
            name: paidMember.name,
            type: 'refund',
            amount: Math.abs(shareDifference),
            wasRemoved: false
          });
        }
      }
    }

    return actions;
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
          <MemberSelect members={otherMembers} bind:selectedMembers initializeAll={false}>
            {#snippet memberExtra({ member, isChecked })}
              {@const existingSplit = expense?.splits.find((s) => s.userId === member.id)}
              {@const hasPaid = existingSplit?.hasPaid ?? false}
              {#if hasPaid}
                <span class="paid-badge" class:removed={!isChecked}>
                  {isChecked ? 'Paid' : 'Paid (removing)'}
                </span>
              {/if}
            {/snippet}
          </MemberSelect>
        </div>

        <div class="form-group">
          <Checkbox
            name="isOptional"
            bind:checked={isOptional}
            label="Optional expense (people can choose to pay)"
          />
        </div>

        <!-- Share change info -->
        {#if splitsChanged()}
          <div class="share-change-info">
            <div class="share-row">
              <span class="share-label">Original share per person:</span>
              <span class="share-value">{formatCurrency(originalShare)}</span>
            </div>
            <div class="share-row">
              <span class="share-label">New share per person:</span>
              <span
                class="share-value"
                class:increased={shareDifference > 0}
                class:decreased={shareDifference < 0}
              >
                {formatCurrency(newShare)}
                {#if shareDifference !== 0}
                  <span class="share-diff">
                    ({shareDifference > 0 ? '+' : ''}{formatCurrency(shareDifference)})
                  </span>
                {/if}
              </span>
            </div>
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
    >
      {hasSettlementActions ? 'Save Changes (Settlement Required)' : 'Save Changes'}
    </Button>
  {/snippet}
</Modal>

<style>
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
