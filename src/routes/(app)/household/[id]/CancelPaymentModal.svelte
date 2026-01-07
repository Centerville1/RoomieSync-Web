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
    currentUserId = '',
    onCancelComplete
  }: {
    open: boolean;
    expense: Expense | null;
    members: Member[];
    currentUserId: string;
    onCancelComplete?: () => void;
  } = $props();

  function getMemberDisplayName(memberId: string) {
    const member = members.find((m) => m.id === memberId);
    return member?.displayName || member?.name || 'Unknown';
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date));
  }

  // Calculate user's share of this expense
  const userShare = $derived(expense ? expense.amount / expense.splits.length : 0);

  // Get the user's split to show when they paid
  const userSplit = $derived(expense?.splits.find((s) => s.userId === currentUserId));

  function handleClose() {
    open = false;
  }
</script>

<Modal bind:open title="Cancel Payment" size="sm">
  {#snippet children()}
    {#if expense}
      <form
        method="POST"
        action="?/cancelPayment"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
            handleClose();
            onCancelComplete?.();
          };
        }}
        id="cancel-payment-form"
      >
        <input type="hidden" name="expenseId" value={expense.id} />

        <div class="cancel-payment-content">
          <div class="warning-icon">!</div>

          <p class="cancel-intro">Are you sure you want to cancel this payment?</p>

          <div class="expense-details">
            <div class="detail-row">
              <span class="detail-label">Expense</span>
              <span class="detail-value">{expense.description}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Paid to</span>
              <span class="detail-value">{getMemberDisplayName(expense.creatorId)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Your share</span>
              <span class="detail-value amount">{formatCurrency(userShare)}</span>
            </div>
            {#if userSplit?.paidAt}
              <div class="detail-row">
                <span class="detail-label">Paid on</span>
                <span class="detail-value">{formatDate(userSplit.paidAt)}</span>
              </div>
            {/if}
          </div>

          <p class="warning-text">
            This will mark the expense as unpaid. You should coordinate with {getMemberDisplayName(
              expense.creatorId
            )} if you need a refund.
          </p>
        </div>
      </form>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Keep Payment</Button>
    <Button type="submit" variant="danger" form="cancel-payment-form">Cancel Payment</Button>
  {/snippet}
</Modal>

<style>
  .cancel-payment-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    text-align: center;
  }

  .warning-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: rgba(245, 158, 11, 0.15);
    color: var(--color-warning, #f59e0b);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .cancel-intro {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .expense-details {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }

  .detail-label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .detail-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
    text-align: right;
  }

  .detail-value.amount {
    color: var(--color-error, #ef4444);
    font-weight: 600;
  }

  .warning-text {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }
</style>
