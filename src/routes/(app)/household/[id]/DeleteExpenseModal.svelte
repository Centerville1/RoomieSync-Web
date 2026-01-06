<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { enhance } from '$app/forms';

  type Member = {
    id: string;
    name: string;
    displayName: string | null;
  };

  type Split = {
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
    splits: Split[];
  };

  let {
    open = $bindable(false),
    expense = null,
    members = [],
    currentUserId = ''
  }: {
    open: boolean;
    expense: Expense | null;
    members: Member[];
    currentUserId: string;
  } = $props();

  function getMemberDisplayName(memberId: string) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return 'Unknown';
    return member.displayName || member.name;
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Get splits where users have already paid (excluding the creator)
  const paidSplits = $derived(() => {
    if (!expense) return [];
    return expense.splits.filter((split) => split.hasPaid && split.userId !== expense.creatorId);
  });

  // Calculate refund amounts per user
  const refundAmounts = $derived(() => {
    if (!expense) return [];
    const splitCount = expense.splits.length;
    const shareAmount = expense.amount / splitCount;

    return paidSplits().map((split) => ({
      userId: split.userId,
      name: getMemberDisplayName(split.userId),
      amount: shareAmount
    }));
  });

  const totalRefunds = $derived(refundAmounts().reduce((sum, item) => sum + item.amount, 0));

  const hasRefunds = $derived(refundAmounts().length > 0);

  function handleClose() {
    open = false;
  }
</script>

<Modal bind:open title="Delete Expense" size="md">
  {#snippet children()}
    {#if expense}
      <form
        method="POST"
        action="?/deleteExpense"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
            handleClose();
          };
        }}
        id="delete-expense-form"
      >
        <input type="hidden" name="expenseId" value={expense.id} />

        <div class="delete-content">
          <div class="expense-summary">
            <span class="expense-description">{expense.description}</span>
            <span class="expense-amount">{formatCurrency(expense.amount)}</span>
          </div>

          {#if hasRefunds}
            <div class="refund-warning">
              <div class="warning-header">
                <span class="warning-icon">⚠️</span>
                <span class="warning-title">Users Have Already Paid</span>
              </div>
              <p class="warning-text">
                The following users have already paid their share of this expense. Please refund
                them before deleting:
              </p>

              <div class="refund-list">
                {#each refundAmounts() as refund}
                  <div class="refund-item">
                    <span class="refund-recipient">Refund {refund.name}</span>
                    <span class="refund-amount">{formatCurrency(refund.amount)}</span>
                  </div>
                {/each}
              </div>

              {#if refundAmounts().length > 1}
                <div class="refund-total">
                  <span class="refund-total-label">Total to Refund</span>
                  <span class="refund-total-amount">{formatCurrency(totalRefunds)}</span>
                </div>
              {/if}

              <p class="refund-instructions">
                Please send the refunds via your preferred payment method (Venmo, Zelle, etc.)
                before confirming deletion.
              </p>
            </div>
          {:else}
            <p class="delete-confirmation">
              Are you sure you want to delete this expense? This action cannot be undone.
            </p>
          {/if}
        </div>
      </form>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Cancel</Button>
    <Button type="submit" variant="danger" form="delete-expense-form">
      {hasRefunds ? "I've Refunded - Delete Expense" : 'Delete Expense'}
    </Button>
  {/snippet}
</Modal>

<style>
  .delete-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .expense-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .expense-description {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .expense-amount {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .refund-warning {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid var(--color-warning, #f59e0b);
    border-radius: var(--radius-md);
  }

  .warning-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
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
    color: var(--color-text-primary);
  }

  .refund-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background-color: var(--color-bg-primary);
    border-radius: var(--radius-md);
  }

  .refund-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
  }

  .refund-item:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  .refund-recipient {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .refund-amount {
    font-weight: 600;
    color: var(--color-error, #ef4444);
  }

  .refund-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border);
  }

  .refund-total-label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .refund-total-amount {
    font-weight: 600;
    color: var(--color-error, #ef4444);
  }

  .refund-instructions {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .delete-confirmation {
    margin: 0;
    color: var(--color-text-primary);
    text-align: center;
  }
</style>
