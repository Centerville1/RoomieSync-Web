<script lang="ts">
  import { shareFor } from '$lib/splits';
  import Modal from '$lib/components/Modal.svelte';
  import CopyAmount from '$lib/components/CopyAmount.svelte';
  import CopyHandle from '$lib/components/CopyHandle.svelte';
  import { providerById, formatHandle, paymentLink } from '$lib/payment-methods';
  import Button from '$lib/components/Button.svelte';
  import { enhance } from '$app/forms';

  type Member = {
    id: string;
    name: string;
    displayName: string | null;
  };

  type Split = {
    userId: string;
    amount: number | null;
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

  type ReverseExpense = {
    id: string;
    description: string;
    amount: number;
    isOptional: boolean;
    creatorId: string;
    createdAt: Date;
    splits: { userId: string; hasPaid: boolean; paidAt: Date | null }[];
  };

  let {
    open = $bindable(false),
    selectedExpenseIds = new Set<string>(),
    expenses = [],
    reverseExpenses = [],
    members = [],
    currentUserId = '',
    onPaymentComplete,
    paymentMethodsByUser = {}
  }: {
    open: boolean;
    selectedExpenseIds: Set<string>;
    expenses: Expense[];
    reverseExpenses: ReverseExpense[];
    members: Member[];
    currentUserId: string;
    onPaymentComplete?: () => void;
    /** How each member wants to be paid, keyed by user id. */
    paymentMethodsByUser?: Record<
      string,
      Array<{ provider: string; handle: string; isPreferred: boolean }>
    >;
  } = $props();

  let showExpenseDetails = $state(false);
  let cancelOutAccepted = $state<Record<string, boolean>>({});

  // Which recipient's alternate methods are open. One at a time: several
  // expanded at once turns a payment list into a wall.
  let expandedMethodsFor = $state<string | null>(null);
  let cancelOutDetailsShown = $state<Record<string, boolean>>({});

  // Reset state when modal opens
  $effect(() => {
    if (open) {
      showExpenseDetails = false;
      cancelOutAccepted = {};
      cancelOutDetailsShown = {};
    }
  });

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
      userShare: shareFor(expense, currentUserId)
    }))
  );

  // Total of all selected expenses (full amounts)
  const totalExpenseAmount = $derived(selectedExpenses.reduce((sum, e) => sum + e.amount, 0));

  // Calculate amounts owed per creator
  const amountsOwedByCreator = $derived(() => {
    const owedMap = new Map<string, number>();

    for (const expense of selectedExpenses) {
      const userShare = shareFor(expense, currentUserId);

      const currentOwed = owedMap.get(expense.creatorId) || 0;
      owedMap.set(expense.creatorId, currentOwed + userShare);
    }

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

  // Cancel-out algorithm per creator
  type CancelOutInfo = {
    originalAmount: number;
    cancelOutAmount: number;
    newAmount: number;
    cancelledExpenses: {
      id: string;
      description: string;
      amount: number;
      theirShare: number;
      createdAt: Date;
    }[];
  };

  const cancelOutData = $derived(() => {
    const result: Record<string, CancelOutInfo> = {};

    for (const payment of amountsOwedByCreator()) {
      const creatorId = payment.creatorId;
      const owedToCreator = payment.amount;

      // Find reverse expenses: expenses created by current user where this creator hasn't paid
      const available = reverseExpenses
        .filter((e) => e.splits.some((s) => s.userId === creatorId && !s.hasPaid))
        .map((e) => {
          // The other person's share of an expense the current user paid for
          const theirShare = shareFor(e, creatorId);
          return {
            id: e.id,
            description: e.description,
            amount: e.amount,
            theirShare,
            createdAt: e.createdAt
          };
        })
        .sort((a, b) => b.theirShare - a.theirShare); // greedy: biggest first

      // Greedily pick expenses whose total share <= owedToCreator
      let remaining = owedToCreator;
      const picked: typeof available = [];
      for (const exp of available) {
        if (exp.theirShare <= remaining) {
          picked.push(exp);
          remaining -= exp.theirShare;
        }
      }

      const cancelOutAmount = picked.reduce((sum, e) => sum + e.theirShare, 0);

      result[creatorId] = {
        originalAmount: owedToCreator,
        cancelOutAmount,
        newAmount: owedToCreator - cancelOutAmount,
        cancelledExpenses: picked
      };
    }

    return result;
  });

  // Effective amount per creator (considering accepted cancel-outs)
  function getEffectiveAmount(creatorId: string): number {
    const data = cancelOutData()[creatorId];
    if (!data || !cancelOutAccepted[creatorId]) return data?.originalAmount ?? 0;
    return data.newAmount;
  }

  const effectiveTotal = $derived(
    amountsOwedByCreator().reduce((sum, p) => sum + getEffectiveAmount(p.creatorId), 0)
  );

  const hasCancelOut = $derived(Object.values(cancelOutData()).some((d) => d.cancelOutAmount > 0));

  function handleClose() {
    open = false;
  }
</script>

{#snippet payMethod(
  method: { provider: string; handle: string; isPreferred: boolean },
  amount: number,
  isPrimary: boolean
)}
  {@const meta = providerById(method.provider)}
  {@const link = paymentLink(method.provider, method.handle, amount)}
  <div class="pay-method" class:primary={isPrimary}>
    <span class="pm-head">
      <span class="pm-name">{meta?.name ?? method.provider}</span>
      <CopyHandle
        handle={formatHandle(method.provider, method.handle)}
        label="{meta?.name ?? method.provider} handle"
      />
    </span>
    {#if link}
      <a class="pm-link" href={link.href} target="_blank" rel="noopener noreferrer">
        {link.label}
        <span class="pm-arrow" aria-hidden="true">↗</span>
      </a>
    {:else}
      <span class="pm-nolink">Copy and paste into your bank app</span>
    {/if}
  </div>
{/snippet}

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

      <!-- Hidden inputs for accepted cancel-out expenses -->
      {#each amountsOwedByCreator() as payment}
        {#if cancelOutAccepted[payment.creatorId]}
          {@const data = cancelOutData()[payment.creatorId]}
          {#if data}
            {#each data.cancelledExpenses as cancelledExp}
              <input type="hidden" name="cancelOutExpenseIds" value={cancelledExp.id} />
              <input type="hidden" name="cancelOutForUserId" value={payment.creatorId} />
            {/each}
          {/if}
        {/if}
      {/each}

      <div class="payment-summary">
        <!-- Hero: what you actually owe per person -->
        <div class="your-share-section">
          <div class="payment-list">
            {#each amountsOwedByCreator() as payment}
              {@const data = cancelOutData()[payment.creatorId]}
              {@const accepted = cancelOutAccepted[payment.creatorId]}
              {@const effective = getEffectiveAmount(payment.creatorId)}
              {@const methods = paymentMethodsByUser[payment.creatorId] ?? []}
              {@const primary = methods[0]}
              {@const alternates = methods.slice(1)}
              {@const primaryMeta = primary ? providerById(primary.provider) : undefined}
              {@const primaryLink = primary
                ? paymentLink(primary.provider, primary.handle, effective)
                : null}
              <div class="payment-item-block">
                <!-- One card per recipient. The headline says who, how much and
                     by what method in a single sentence, because that is the
                     whole instruction: "Send Aidan $13.86 via Zelle". -->
                <div class="payment-head">
                  <div class="payment-line">
                    <span class="payment-recipient">
                      Send {payment.name}
                    </span>
                    {#if accepted && data && data.cancelOutAmount > 0 && effective === 0}
                      <span class="payment-amount-zero">nothing</span>
                    {:else}
                      {#if accepted && data && data.cancelOutAmount > 0}
                        <span class="payment-amount-original">{formatCurrency(payment.amount)}</span
                        >
                      {/if}
                      <CopyAmount
                        amount={accepted && data && data.cancelOutAmount > 0
                          ? effective
                          : payment.amount}
                        label="Amount to send {payment.name}"
                      />
                    {/if}
                    {#if primaryMeta}
                      <span class="payment-via">via {primaryMeta.name}</span>
                    {/if}
                  </div>

                  {#if primary && effective > 0}
                    <div class="payment-handle-row">
                      <CopyHandle
                        handle={formatHandle(primary.provider, primary.handle)}
                        label="{primaryMeta?.name ?? primary.provider} handle"
                      />
                      {#if primaryLink}
                        <a
                          class="pm-link"
                          href={primaryLink.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {primaryLink.label}
                          <span class="pm-arrow" aria-hidden="true">↗</span>
                        </a>
                      {/if}
                    </div>
                  {:else if effective > 0}
                    <p class="payment-nomethod">
                      {payment.name} has not said how to pay them yet.
                    </p>
                  {/if}

                  {#if alternates.length > 0 && effective > 0}
                    <button
                      type="button"
                      class="pm-more"
                      aria-expanded={expandedMethodsFor === payment.creatorId}
                      aria-controls="alt-methods-{payment.creatorId}"
                      onclick={() =>
                        (expandedMethodsFor =
                          expandedMethodsFor === payment.creatorId ? null : payment.creatorId)}
                    >
                      <span
                        class="pm-chevron"
                        class:open={expandedMethodsFor === payment.creatorId}
                        aria-hidden="true">⌄</span
                      >
                      {expandedMethodsFor === payment.creatorId
                        ? 'Hide other ways'
                        : `Other ways to pay ${payment.name} (${alternates.length})`}
                    </button>

                    {#if expandedMethodsFor === payment.creatorId}
                      <div class="pm-alternates" id="alt-methods-{payment.creatorId}">
                        {#each alternates as method (method.provider + method.handle)}
                          {@render payMethod(method, effective, false)}
                        {/each}
                      </div>
                    {/if}
                  {/if}
                </div>

                <!-- Cancel-out offer -->
                {#if data && data.cancelOutAmount > 0}
                  <div class="cancel-out-section">
                    {#if !accepted}
                      <div class="cancel-out-offer">
                        <span class="cancel-out-text">
                          Cancel-out available: {data.newAmount > 0
                            ? `pay ${formatCurrency(data.newAmount)} instead`
                            : 'no payment needed'}
                        </span>
                        <button
                          type="button"
                          class="cancel-out-accept-btn"
                          onclick={() => (cancelOutAccepted[payment.creatorId] = true)}
                        >
                          Accept
                        </button>
                      </div>
                    {:else}
                      <div class="cancel-out-accepted">
                        <span class="cancel-out-accepted-text">
                          Cancel-out applied: -{formatCurrency(data.cancelOutAmount)}
                        </span>
                        <button
                          type="button"
                          class="cancel-out-undo"
                          onclick={() => (cancelOutAccepted[payment.creatorId] = false)}
                        >
                          Undo
                        </button>
                      </div>
                    {/if}

                    <!-- Always-available details toggle -->
                    <button
                      type="button"
                      class="cancel-out-details-toggle"
                      onclick={() =>
                        (cancelOutDetailsShown[payment.creatorId] =
                          !cancelOutDetailsShown[payment.creatorId])}
                      aria-expanded={cancelOutDetailsShown[payment.creatorId] ?? false}
                    >
                      <span>
                        {cancelOutDetailsShown[payment.creatorId] ? 'Hide' : 'View'} cancel-out details
                      </span>
                      <svg
                        class="chevron"
                        class:expanded={cancelOutDetailsShown[payment.creatorId]}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    {#if cancelOutDetailsShown[payment.creatorId]}
                      <div class="cancel-out-details-list">
                        <p class="cancel-out-explanation">
                          {payment.name} owes you for these expenses. Cancelling out marks them as paid
                          and reduces what you send.
                        </p>
                        {#each data.cancelledExpenses as exp}
                          <div class="cancel-out-detail-item">
                            <div class="cancel-out-detail-main">
                              <span class="cancel-out-desc">{exp.description}</span>
                              <span class="cancel-out-date">{formatDate(exp.createdAt)}</span>
                            </div>
                            <span class="cancel-out-share">
                              -{formatCurrency(exp.theirShare)}
                            </span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          {#if amountsOwedByCreator().length > 1}
            <div class="payment-summary-total">
              <span class="summary-total-label">Total</span>
              <span class="summary-total-amount">{formatCurrency(effectiveTotal)}</span>
            </div>
          {/if}
        </div>

        <!-- Collapsible expense breakdown -->
        <button
          type="button"
          class="expense-details-toggle"
          onclick={() => (showExpenseDetails = !showExpenseDetails)}
          aria-expanded={showExpenseDetails}
        >
          <span>
            {showExpenseDetails ? 'Hide' : 'Show'}
            {selectedExpenses.length}
            {selectedExpenses.length === 1 ? 'expense' : 'expenses'} (totaling {formatCurrency(
              totalExpenseAmount
            )})
          </span>
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

        <!-- Only kept for the zero case, where the reason nothing needs sending
             is not otherwise obvious. The generic "send the amounts via Venmo,
             Zelle, etc." is gone: each card now names the actual method, so
             restating it in the abstract only added noise. -->
        {#if effectiveTotal === 0 && hasCancelOut}
          <div class="payment-instructions">
            <p class="instructions-text instructions-zero">
              Everything cancels out. Mark as paid to settle up.
            </p>
          </div>
        {/if}
      </div>
    </form>
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Back to Selection</Button>
    {#if effectiveTotal === 0 && hasCancelOut}
      <Button type="submit" variant="primary" form="pay-expenses-form">Confirm Cancel-out</Button>
    {:else}
      <Button type="submit" variant="primary" form="pay-expenses-form">Mark as Paid</Button>
    {/if}
  {/snippet}
</Modal>

<style>
  .pay-method {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .pm-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    min-width: 0;
  }

  .pm-name {
    color: var(--color-text-primary);
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* A real button rather than a text link: this is the action most people
     want, and it needs to look like one on a phone. */
  .pm-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 36px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-primary);
    border-radius: 999px;
    color: var(--color-primary);
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .pm-link:hover {
    background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
    text-decoration: none;
  }

  .pm-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .pm-arrow {
    font-size: 0.68rem;
  }

  /* Says why there is no button, rather than leaving a gap that reads as a
     missing feature. */
  .pm-nolink {
    color: var(--color-text-tertiary);
    font-size: 0.72rem;
    font-style: italic;
  }

  .pm-more {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    min-height: 32px;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
  }

  .pm-more:hover {
    color: var(--color-text-primary);
  }

  .pm-more:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 45%, transparent);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }

  .pm-chevron {
    display: inline-block;
    font-size: 0.9rem;
    line-height: 1;
    transition: transform 0.15s;
  }

  .pm-chevron.open {
    transform: rotate(180deg);
  }

  .pm-alternates {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm) 0 var(--space-xs) var(--space-sm);
    border-left: 2px solid var(--color-border);
  }

  /* An alternate is a fallback, so it sits quieter than the preferred one */
  .pm-alternates .pm-link {
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }

  .pm-alternates .pm-link:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  @media (max-width: 767px) {
    .pay-method {
      align-items: flex-start;
    }

    .pm-head {
      flex-direction: column;
      gap: 0;
    }
  }

  .payment-summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
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
    flex-shrink: 0;
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
    gap: 0;
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .payment-list {
    display: flex;
    flex-direction: column;
  }

  /* One card per recipient: everything about paying this person, including
     the cancel-out, lives inside a single bordered box. The old version split
     the same information across three dashed dividers, which read as three
     unrelated sections. */
  .payment-item-block {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    margin-bottom: var(--space-sm);
    overflow: hidden;
  }

  .payment-item-block:last-child {
    margin-bottom: 0;
  }

  .payment-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-md);
  }

  /* Reads as one sentence: Send Aidan $13.86 via Zelle */
  .payment-line {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .payment-via {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    font-weight: 600;
  }

  /* Small, under the headline, because it is a detail you copy rather than
     something to read every time. */
  .payment-handle-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .payment-nomethod {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: 0.78rem;
    font-style: italic;
  }

  .payment-recipient {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .payment-amount-original {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-tertiary);
    text-decoration: line-through;
  }

  .payment-amount-zero {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-success, #22c55e);
  }

  /* Cancel-out styles */
  /* Inside the card, on a tinted ground so it reads as part of this payment
     rather than a separate panel underneath it. */
  .cancel-out-section {
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .cancel-out-offer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background-color: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: var(--radius-md);
  }

  .cancel-out-text {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-success, #22c55e);
  }

  .cancel-out-accept-btn {
    padding: var(--space-xs) var(--space-md);
    font-size: 0.8rem;
    font-weight: 600;
    color: white;
    background-color: var(--color-success, #22c55e);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
  }

  .cancel-out-accept-btn:hover {
    opacity: 0.85;
  }

  .cancel-out-accepted {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background-color: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: var(--radius-md);
  }

  .cancel-out-accepted-text {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-success, #22c55e);
  }

  .cancel-out-undo {
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .cancel-out-undo:hover {
    background-color: var(--color-bg-tertiary);
  }

  .cancel-out-details-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .cancel-out-details-toggle:hover {
    color: var(--color-text-secondary);
  }

  .cancel-out-details-list {
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .cancel-out-explanation {
    margin: 0;
    font-size: 0.7rem;
    color: var(--color-text-tertiary);
    line-height: 1.4;
  }

  .cancel-out-detail-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-xs) 0;
  }

  .cancel-out-detail-item:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  .cancel-out-detail-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .cancel-out-desc {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cancel-out-date {
    font-size: 0.7rem;
    color: var(--color-text-tertiary);
  }

  .cancel-out-share {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-success, #22c55e);
    flex-shrink: 0;
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

  .instructions-zero {
    color: var(--color-success, #22c55e);
    border-color: var(--color-success, #22c55e);
  }

  .payment-instructions:has(.instructions-zero) {
    background-color: rgba(34, 197, 94, 0.08);
    border-color: rgba(34, 197, 94, 0.3);
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
