<script lang="ts">
  import { onMount } from 'svelte';

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

  type MemberBalance = {
    owesYou: number;
    owesYouOptional: number;
    youOwe: number;
    youOweOptional: number;
  };

  type Props = {
    members?: Member[];
    expenses?: Expense[];
    onLoadMore?: () => Promise<void>;
    hasMore?: boolean;
    currentUserId?: string;
    selectedExpenseIds?: Set<string>;
    onSelectionChange?: (selectedIds: Set<string>) => void;
    memberBalances?: Record<string, MemberBalance>;
    onEditExpense?: (expense: Expense) => void;
    onDeleteExpense?: (expense: Expense) => void;
    onSplitCost?: () => void;
  };

  let {
    members = [],
    expenses = [],
    onLoadMore,
    hasMore = false,
    currentUserId,
    selectedExpenseIds = new Set(),
    onSelectionChange,
    memberBalances = {},
    onEditExpense,
    onDeleteExpense,
    onSplitCost
  }: Props = $props();

  // Track hover state for the split cost row
  let splitCostRowHovered = $state(false);

  // Sort members to show current user first
  const sortedMembers = $derived(
    [...members].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return 0;
    })
  );

  let scrollContainer: HTMLDivElement;
  let isLoadingMore = $state(false);

  function getMemberDisplayName(member: Member) {
    return member.displayName || member.name;
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function formatDateTime(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date));
  }

  function formatShortDateTime(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date));
  }

  function getUserShare(expense: Expense): number {
    return expense.amount / expense.splits.length;
  }

  function getPaymentStatus(
    expense: Expense,
    memberId: string
  ): 'paid' | 'unpaid' | 'not-included' | 'creator' {
    if (expense.creatorId === memberId) {
      return 'creator';
    }
    const split = expense.splits.find((s) => s.userId === memberId);
    if (!split) {
      return 'not-included';
    }
    return split.hasPaid ? 'paid' : 'unpaid';
  }

  function isSelectableByCurrentUser(expense: Expense): boolean {
    if (!currentUserId) return false;
    // Can't select expenses I created
    if (expense.creatorId === currentUserId) return false;
    // Can only select if I'm in the split and haven't paid yet
    const mySplit = expense.splits.find((s) => s.userId === currentUserId);
    return mySplit !== undefined && !mySplit.hasPaid;
  }

  function toggleExpenseSelection(expenseId: string) {
    if (!onSelectionChange) return;
    const newSelection = new Set(selectedExpenseIds);
    if (newSelection.has(expenseId)) {
      newSelection.delete(expenseId);
    } else {
      newSelection.add(expenseId);
    }
    onSelectionChange(newSelection);
  }

  async function handleScroll() {
    if (!scrollContainer || !onLoadMore || !hasMore || isLoadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    // Load more when user scrolls within 100px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
      isLoadingMore = true;
      try {
        await onLoadMore();
      } finally {
        isLoadingMore = false;
      }
    }
  }

  onMount(() => {
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  });
</script>

<div class="expense-grid-wrapper">
  <!-- Scrollable container for both header and content -->
  <div class="scroll-container" bind:this={scrollContainer}>
    <div class="grid-content" style="--member-count: {sortedMembers.length}">
      <!-- Sticky header -->
      <div class="grid-header">
        {#each sortedMembers as member}
          {@const isCurrentUser = member.id === currentUserId}
          {@const balance = memberBalances[member.id]}
          <div class="member-header" class:current-user={isCurrentUser}>
            <span class="member-name">
              {getMemberDisplayName(member)}{#if isCurrentUser}
                (You){/if}
            </span>
            {#if !isCurrentUser && balance}
              {@const hasOwesYou = balance.owesYou > 0 || balance.owesYouOptional > 0}
              {@const hasYouOwe = balance.youOwe > 0 || balance.youOweOptional > 0}
              <div class="member-balance">
                <div class="balance-items">
                  {#if hasOwesYou}
                    <span class="owes-you">Owes you: {formatCurrency(balance.owesYou)}</span>
                    {#if balance.owesYouOptional > 0}
                      <span class="balance-optional"
                        ><span class="optional-badge">Optional</span>
                        {formatCurrency(balance.owesYouOptional)}</span
                      >
                    {/if}
                  {/if}
                  {#if hasYouOwe}
                    <span class="you-owe">You owe: {formatCurrency(balance.youOwe)}</span>
                    {#if balance.youOweOptional > 0}
                      <span class="balance-optional"
                        ><span class="optional-badge">Optional</span>
                        {formatCurrency(balance.youOweOptional)}</span
                      >
                    {/if}
                  {/if}
                  {#if !hasOwesYou && !hasYouOwe}
                    <span class="settled">Settled up</span>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Grid body -->
      <div class="expense-grid">
        <!-- Split the Cost row -->
        {#if onSplitCost}
          <div
            class="grid-row split-cost-row"
            class:hovered={splitCostRowHovered}
            onclick={onSplitCost}
            onkeydown={(e) => e.key === 'Enter' && onSplitCost?.()}
            onmouseenter={() => (splitCostRowHovered = true)}
            onmouseleave={() => (splitCostRowHovered = false)}
            role="button"
            tabindex="0"
          >
            {#each sortedMembers as member}
              {@const isCurrentUser = member.id === currentUserId}
              <div
                class="grid-cell split-cost-cell"
                class:current-user-cell={isCurrentUser}
              >
                {#if isCurrentUser}
                  <div class="split-cost-content">
                    <img src="/icon-nobg.png" alt="" class="split-cost-logo" />
                    <div class="split-cost-text">
                      <span class="split-cost-title">Split the Cost</span>
                      <span class="split-cost-subtitle">Click to create expense</span>
                    </div>
                  </div>
                  {#if splitCostRowHovered}
                    <div class="split-cost-plus-container">
                      <span class="split-cost-plus">+</span>
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        {#each expenses as expense}
          {@const isSelectable = isSelectableByCurrentUser(expense)}
          {@const isSelected = selectedExpenseIds.has(expense.id)}
          {@const needsToPay = isSelectable && !expense.isOptional}
          <div
            class="grid-row"
            class:selectable={isSelectable}
            class:selected={isSelected}
            class:needs-to-pay={needsToPay}
            onclick={isSelectable ? () => toggleExpenseSelection(expense.id) : undefined}
            onkeydown={isSelectable
              ? (e) => e.key === 'Enter' && toggleExpenseSelection(expense.id)
              : undefined}
            role={isSelectable ? 'button' : undefined}
            tabindex={isSelectable ? 0 : undefined}
          >
            {#each sortedMembers as member}
              {@const status = getPaymentStatus(expense, member.id)}
              {@const isMyExpense = expense.creatorId === currentUserId}
              {@const isCreatorCell = status === 'creator'}
              {@const isMyColumn = member.id === currentUserId}
              <div
                class="grid-cell"
                class:creator={isCreatorCell}
                class:selected={isSelected && isCreatorCell}
                class:needs-to-pay={needsToPay}
                class:needs-to-pay-accent={needsToPay && isCreatorCell}
                class:first-column={isMyColumn}
              >
                {#if isCreatorCell}
                  <div class="expense-cell-content">
                    {#if isMyExpense}
                      <div class="expense-actions">
                        <button
                          type="button"
                          class="action-btn edit-btn"
                          title="Edit expense"
                          onclick={(e) => {
                            e.stopPropagation();
                            onEditExpense?.(expense);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          class="action-btn delete-btn"
                          title="Delete expense"
                          onclick={(e) => {
                            e.stopPropagation();
                            onDeleteExpense?.(expense);
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    {/if}
                    <div class="expense-info">
                      <span class="expense-description">
                        {expense.description} - {formatDateTime(expense.createdAt)}
                        {#if expense.isOptional}
                          <span class="optional-badge">Optional</span>
                        {/if}
                      </span>
                      <span
                        class="expense-amount"
                        class:my-expense={isMyExpense}
                        class:other-expense={!isMyExpense}
                      >
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  </div>
                {:else if status === 'paid'}
                  {@const split = expense.splits.find((s) => s.userId === member.id)}
                  {@const paidAt = split?.paidAt}
                  <div class="paid-status">
                    <span class="status-icon paid" title="Paid">✓</span>
                    {#if isMyExpense && paidAt}
                      <span class="paid-info">
                        Paid you {formatCurrency(getUserShare(expense))}
                        <span class="paid-date">{formatShortDateTime(paidAt)}</span>
                      </span>
                    {:else if isMyColumn && paidAt}
                      <span class="paid-info you-paid">
                        You paid {formatCurrency(getUserShare(expense))}
                        <span class="paid-date">{formatShortDateTime(paidAt)}</span>
                      </span>
                    {/if}
                  </div>
                {:else if status === 'unpaid'}
                  {#if expense.isOptional}
                    <div class="optional-status">
                      <span class="status-icon optional" title="Optional - Unpaid">?</span>
                      <span class="optional-amount"
                        ><span class="optional-badge">Optional</span>
                        {formatCurrency(getUserShare(expense))}</span
                      >
                    </div>
                  {:else}
                    <div class="unpaid-status">
                      <span
                        class="status-icon unpaid"
                        class:other-column={!isMyColumn}
                        class:selected-check={isSelected && isMyColumn}
                        title={isSelected && isMyColumn ? 'Selected' : 'Unpaid'}
                        >{isSelected && isMyColumn ? '☑' : '☐'}</span
                      >
                      {#if isMyExpense}
                        <span class="owes-info"
                          >Owes you {formatCurrency(getUserShare(expense))}</span
                        >
                      {:else if isMyColumn}
                        <span class="you-owe-info"
                          >You owe {formatCurrency(getUserShare(expense))}</span
                        >
                      {/if}
                    </div>
                  {/if}
                {:else}
                  <span class="status-icon not-included" title="Not included">—</span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}

        {#if expenses.length === 0}
          <div class="empty-state">No expenses yet</div>
        {/if}

        {#if isLoadingMore}
          <div class="loading-more">Loading more...</div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .expense-grid-wrapper {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: var(--color-bg-primary);
    max-height: 500px;
    margin-bottom: var(--space-lg);
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .scroll-container {
    overflow: auto;
    flex: 1;
    min-height: 0;
  }

  .grid-content {
    min-width: max-content;
  }

  .grid-header {
    display: grid;
    grid-template-columns: repeat(var(--member-count), minmax(150px, 1fr));
    background-color: var(--color-bg-tertiary);
    border-bottom: 2px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .member-header {
    padding: var(--space-md);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    justify-content: center;
  }

  .member-header.current-user {
    background-color: var(--color-bg-secondary);
  }

  .member-name {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .member-balance {
    display: flex;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .balance-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .member-balance .owes-you {
    color: var(--color-success);
  }

  .member-balance .you-owe {
    color: var(--color-error);
  }

  .member-balance .balance-optional {
    color: var(--color-secondary, #6b7fff);
    font-size: 0.625rem;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: var(--space-md);
  }

  .member-balance .balance-optional .optional-badge {
    margin-left: 0;
    background-color: rgba(107, 127, 255, 0.15);
    color: var(--color-secondary, #6b7fff);
  }

  .member-balance .settled {
    color: var(--color-text-tertiary);
  }

  .expense-grid {
    display: grid;
    grid-template-columns: repeat(var(--member-count), minmax(150px, 1fr));
  }

  .grid-row {
    display: contents;
  }

  /* Split the Cost row styles */
  .split-cost-row {
    display: contents;
    cursor: pointer;
  }

  .split-cost-row .split-cost-cell {
    position: relative;
    background-color: var(--color-bg-secondary);
    transition: background-color 0.2s ease;
    border-bottom: 3px solid var(--color-border);
  }

  .split-cost-row.hovered .split-cost-cell {
    background-color: rgba(16, 185, 129, 0.08);
    border-bottom-color: var(--color-success, #10b981);
  }

  .split-cost-row .split-cost-cell.current-user-cell {
    background-color: rgba(16, 185, 129, 0.06);
    border-left: 3px solid var(--color-success, #10b981);
  }

  .split-cost-row.hovered .split-cost-cell.current-user-cell {
    background-color: rgba(16, 185, 129, 0.15);
  }

  .split-cost-content {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .split-cost-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
    transition: transform 0.2s ease;
  }

  .split-cost-row.hovered .split-cost-logo {
    transform: scale(1.1);
  }

  .split-cost-plus-container {
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translate(-50%, 50%);
    z-index: 1;
  }

  .split-cost-plus {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--color-success, #10b981);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .split-cost-text {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .split-cost-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-success, #10b981);
  }

  .split-cost-subtitle {
    font-size: 0.7rem;
    color: var(--color-text-tertiary);
    transition: color 0.2s ease;
  }

  .split-cost-row.hovered .split-cost-subtitle {
    color: var(--color-success, #10b981);
  }

  .split-cost-row.hovered .split-cost-cell {
    box-shadow: 0 3px 8px rgba(16, 185, 129, 0.3);
  }

  .grid-cell {
    padding: var(--space-md);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60px;
    transition:
      background-color 0.15s ease,
      outline 0.15s ease;
  }

  .grid-cell.creator {
    background-color: var(--color-bg-secondary);
  }

  .grid-cell.first-column {
    border-right: 3px solid rgba(255, 255, 255, 0.6);
  }

  .grid-row.selectable .grid-cell {
    cursor: pointer;
  }

  .grid-row.selectable:not(.selected):hover .grid-cell {
    background-color: rgba(239, 68, 68, 0.15);
  }

  .grid-row.selectable:not(.selected):hover .grid-cell.needs-to-pay-accent {
    background-color: rgba(239, 68, 68, 0.5);
  }

  .grid-row.selected .grid-cell {
    background-color: rgba(239, 68, 68, 0.25);
  }

  .grid-row.selected:hover .grid-cell {
    background-color: rgba(239, 68, 68, 0.35);
  }

  .grid-row.selected:hover .grid-cell.creator {
    background-color: rgba(239, 68, 68, 0.45);
  }

  .grid-row.selected .grid-cell.creator {
    background-color: rgba(239, 68, 68, 0.35);
    outline: 2px solid var(--color-error, #ef4444);
    outline-offset: -2px;
  }

  .grid-cell.needs-to-pay {
    background-color: rgba(239, 68, 68, 0.04);
  }

  .grid-cell.needs-to-pay.first-column {
    border-left: 3px solid var(--color-error, #ef4444);
  }

  .grid-cell.needs-to-pay-accent {
    background-color: rgba(239, 68, 68, 0.4);
  }

  .expense-cell-content {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding-right: var(--space-sm);
    padding-left: var(--space-sm);
  }

  .expense-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    text-align: center;
    max-width: calc(100% - 60px);
  }

  .expense-actions {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .action-btn {
    background: none;
    border: none;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.15s ease;
    line-height: 1;
  }

  .action-btn:hover {
    background-color: var(--color-bg-tertiary);
  }

  .action-btn.edit-btn {
    color: var(--color-success);
  }

  .action-btn.edit-btn:hover {
    background-color: rgba(34, 197, 94, 0.15);
  }

  .action-btn.delete-btn {
    color: var(--color-error);
  }

  .action-btn.delete-btn:hover {
    background-color: rgba(239, 68, 68, 0.15);
  }

  .expense-description {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .optional-badge {
    font-size: 0.625rem;
    padding: 2px 6px;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    margin-left: var(--space-xs);
  }

  .expense-amount {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .expense-amount.my-expense {
    color: var(--color-success, #22c55e);
  }

  .expense-amount.other-expense {
    color: var(--color-error, #ef4444);
  }

  .status-icon {
    font-size: 1.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
  }

  .status-icon.paid {
    color: var(--color-success);
    background-color: rgba(34, 197, 94, 0.1);
  }

  .paid-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .paid-info {
    font-size: 0.7rem;
    color: var(--color-success);
    font-weight: 500;
    text-align: center;
    line-height: 1.3;
  }

  .paid-date {
    display: block;
    color: var(--color-text-tertiary);
    font-weight: 400;
  }

  .unpaid-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .owes-info {
    font-size: 0.7rem;
    color: var(--color-success);
    font-weight: 500;
    text-align: center;
  }

  .you-owe-info {
    font-size: 0.7rem;
    color: var(--color-warning, #f59e0b);
    font-weight: 500;
    text-align: center;
  }

  .status-icon.unpaid {
    color: var(--color-warning, #f59e0b);
    background-color: rgba(245, 158, 11, 0.1);
  }

  .status-icon.unpaid.other-column {
    color: var(--color-text-tertiary);
    background-color: var(--color-bg-tertiary);
  }

  .status-icon.unpaid.selected-check {
    color: var(--color-primary, #ff7a4d);
    background-color: rgba(255, 122, 77, 0.15);
  }

  .status-icon.optional {
    color: var(--color-secondary, #6b7fff);
    background-color: rgba(107, 127, 255, 0.1);
  }

  .optional-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .optional-amount {
    font-size: 0.7rem;
    color: var(--color-secondary, #6b7fff);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .optional-amount .optional-badge {
    background-color: rgba(107, 127, 255, 0.15);
    color: var(--color-secondary, #6b7fff);
  }

  .status-icon.not-included {
    color: var(--color-text-tertiary);
    background-color: transparent;
  }

  .empty-state,
  .loading-more {
    grid-column: 1 / -1;
    padding: var(--space-xl);
    text-align: center;
    color: var(--color-text-tertiary);
  }

  .loading-more {
    padding: var(--space-md);
    font-size: 0.875rem;
  }
</style>
