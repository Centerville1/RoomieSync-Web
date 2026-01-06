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
    selectedExpenseIds = new Set<string>(),
    expenses = [],
    members = [],
    currentUserId = '',
    onPaymentComplete
  }: {
    open: boolean;
    selectedExpenseIds: Set<string>;
    expenses: Expense[];
    members: Member[];
    currentUserId: string;
    onPaymentComplete?: () => void;
  } = $props();

  let showExpenseDetails = $state(false);

  function getMemberDisplayName(member: Member) {
    return member.displayName || member.name;
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
      year: 'numeric'
    }).format(new Date(date));
  }

  // Get selected expenses with user's share calculated
  const selectedExpenses = $derived(expenses.filter((e) => selectedExpenseIds.has(e.id)));

  const selectedExpensesWithShare = $derived(
    selectedExpenses.map((expense) => ({
      ...expense,
      userShare: expense.amount / expense.splits.length
    }))
  );

  // Total of all selected expenses (full amounts)
  const totalExpenseAmount = $derived(selectedExpenses.reduce((sum, e) => sum + e.amount, 0));

  // Calculate amounts owed per creator
  const amountsOwedByCreator = $derived(() => {
    const owedMap = new Map<string, number>();

    for (const expense of selectedExpenses) {
      // Calculate user's share: total amount / number of people in the split
      const splitCount = expense.splits.length;
      const userShare = expense.amount / splitCount;

      const currentOwed = owedMap.get(expense.creatorId) || 0;
      owedMap.set(expense.creatorId, currentOwed + userShare);
    }

    // Convert to array with member info
    return Array.from(owedMap.entries())
      .map(([creatorId, amount]) => {
        const member = members.find((m) => m.id === creatorId);
        return {
          creatorId,
          name: member ? getMemberDisplayName(member) : 'Unknown',
          amount
        };
      })
      .sort((a, b) => b.amount - a.amount);
  });

  const totalOwed = $derived(amountsOwedByCreator().reduce((sum, item) => sum + item.amount, 0));

  function handleClose() {
    open = false;
  }
</script>

<Modal bind:open title="Pay Expenses" size="md">
  {#snippet children()}
    <form
      method="POST"
      action="?/markExpensesPaid"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
          handleClose();
          onPaymentComplete?.();
        };
      }}
      id="pay-expenses-form"
    >
      {#each Array.from(selectedExpenseIds) as expenseId}
        <input type="hidden" name="expenseIds" value={expenseId} />
      {/each}

      <div class="payment-summary">
        <!-- Summary header -->
        <p class="summary-intro">
          You selected <strong>{selectedExpenses.length}</strong>
          {selectedExpenses.length === 1 ? 'expense' : 'expenses'} to pay, totaling
          <strong>{formatCurrency(totalExpenseAmount)}</strong>
        </p>

        <!-- Collapsible expense details -->
        <button
          type="button"
          class="expense-details-toggle"
          onclick={() => (showExpenseDetails = !showExpenseDetails)}
          aria-expanded={showExpenseDetails}
        >
          <span>{showExpenseDetails ? 'Hide' : 'Show'} selected expenses</span>
          <svg
            class="chevron"
            class:expanded={showExpenseDetails}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {#if showExpenseDetails}
          <div class="expense-details-list">
            {#each selectedExpensesWithShare as expense}
              <div class="expense-detail-item">
                <div class="expense-detail-main">
                  <span class="expense-description">{expense.description}</span>
                  <span class="expense-date">{formatDate(expense.createdAt)}</span>
                </div>
                <div class="expense-detail-amounts">
                  <span class="expense-total-amount">{formatCurrency(expense.amount)}</span>
                  <span class="expense-your-share"
                    >Your share: {formatCurrency(expense.userShare)}</span
                  >
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Your Share section -->
        <div class="your-share-section">
          <h3 class="your-share-title">Your Share</h3>

          <div class="payment-list">
            {#each amountsOwedByCreator() as payment}
              <div class="payment-item">
                <span class="payment-recipient">Pay {payment.name}</span>
                <span class="payment-amount">{formatCurrency(payment.amount)}</span>
              </div>
            {/each}
          </div>

          {#if amountsOwedByCreator().length > 1}
            <div class="payment-summary-total">
              <span class="summary-total-label">Total to Pay</span>
              <span class="summary-total-amount">{formatCurrency(totalOwed)}</span>
            </div>
          {/if}
        </div>

        <div class="payment-instructions">
          <p class="instructions-text">
            Please send the amounts above via your preferred payment method (Venmo, Zelle, etc.),
            then click "Mark as Paid" to record the payment.
          </p>
        </div>
      </div>
    </form>
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Back to Selection</Button>
    <Button type="submit" variant="primary" form="pay-expenses-form">Mark as Paid</Button>
  {/snippet}
</Modal>

<style>
  .payment-summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .summary-intro {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1rem;
  }

  .summary-intro strong {
    color: var(--color-primary);
  }

  /* Expense details toggle */
  .expense-details-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .expense-details-toggle:hover {
    background-color: var(--color-bg-tertiary);
  }

  .chevron {
    transition: transform 0.2s ease;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  /* Expense details list */
  .expense-details-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    max-height: 200px;
    overflow-y: auto;
  }

  .expense-detail-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-sm) 0;
  }

  .expense-detail-item:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  .expense-detail-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-width: 0;
    flex: 1;
  }

  .expense-description {
    font-weight: 500;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .expense-date {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .expense-detail-amounts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .expense-total-amount {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .expense-your-share {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  /* Your Share section */
  .your-share-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .your-share-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .payment-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .payment-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
  }

  .payment-item:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  .payment-recipient {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .payment-amount {
    font-weight: 600;
    color: var(--color-error, #ef4444);
  }

  /* Payment instructions */
  .payment-instructions {
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

  /* Summary total (only shown when multiple recipients) */
  .payment-summary-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--color-border);
  }

  .summary-total-label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .summary-total-amount {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }
</style>
