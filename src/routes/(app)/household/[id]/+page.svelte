<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Input from '$lib/components/Input.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import SplitCostModal from './SplitCostModal.svelte';
  import PayExpensesModal from './PayExpensesModal.svelte';
  import EditExpenseModal from './EditExpenseModal.svelte';
  import DeleteExpenseModal from './DeleteExpenseModal.svelte';
  import ImportExpenseModal from './ImportExpenseModal.svelte';
  import CancelPaymentModal from './CancelPaymentModal.svelte';
  import NudgeModal from './NudgeModal.svelte';
  import ExpenseList from './ExpenseList.svelte';
  import MemberBalanceList from './MemberBalanceList.svelte';
  import BalanceChart from './BalanceChart.svelte';
  import HouseholdInfoCard from './HouseholdInfoCard.svelte';
  import TagManagerModal from './TagManagerModal.svelte';
  import { shareFor } from '$lib/splits';
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let showSplitCostModal = $state(false);
  let showPayExpensesModal = $state(false);
  let showEditExpenseModal = $state(false);
  let showDeleteExpenseModal = $state(false);
  let showImportExpenseModal = $state(false);
  let showCancelPaymentModal = $state(false);
  let showNudgeModal = $state(false);
  // The two totals are what people check; the chart is occasional, and it costs
  // a lot of vertical space on a phone.
  let showBalanceHistory = $state(false);
  let showTagModal = $state(false);
  let importExpenseDefaultCreatorId = $state('');

  // Nudge state
  let nudgeRecipientId = $state('');
  let nudgeRecipientName = $state('');
  let nudgeAmountOwed = $state(0);

  // Toast state for received nudges
  let showNudgeToast = $state(false);
  let nudgeToastData = $state<{ senderName: string; amount: number } | null>(null);

  // Expense being edited/deleted/cancel payment
  type Expense = {
    id: string;
    description: string;
    amount: number;
    isOptional: boolean;
    tagId: string | null;
    dueDate: string | null;
    creatorId: string;
    createdAt: Date;
    splits: { userId: string; amount: number | null; hasPaid: boolean; paidAt: Date | null }[];
  };
  // Admins define the tag vocabulary; every member can apply an existing tag
  const isAdmin = $derived(data.userRole === 'admin');

  let selectedExpenseForEdit = $state<Expense | null>(null);
  let selectedExpenseForDelete = $state<Expense | null>(null);
  let selectedExpenseForCancelPayment = $state<Expense | null>(null);

  function handleEditExpense(expense: Expense) {
    selectedExpenseForEdit = expense;
    showEditExpenseModal = true;
  }

  function handleDeleteExpense(expense: Expense) {
    selectedExpenseForDelete = expense;
    showDeleteExpenseModal = true;
  }

  function handleImportExpense(memberId: string) {
    importExpenseDefaultCreatorId = memberId;
    showImportExpenseModal = true;
  }

  function handleCancelPayment(expense: Expense) {
    selectedExpenseForCancelPayment = expense;
    showCancelPaymentModal = true;
  }

  function handleNudge(memberId: string, memberName: string, amountOwed: number) {
    nudgeRecipientId = memberId;
    nudgeRecipientName = memberName;
    nudgeAmountOwed = amountOwed;
    showNudgeModal = true;
  }

  function handleNudgeSent() {
    // The page will reload with updated data after form submission
  }

  // Show toast if user was nudged recently and still owes money
  onMount(() => {
    if (data.nudgesReceived && data.nudgesReceived.length > 0) {
      const latestNudge = data.nudgesReceived[0];
      const sender = data.members.find((m) => m.id === latestNudge.fromUserId);
      const balance = data.memberBalances[latestNudge.fromUserId];

      // Only show toast if you still owe them money
      if (sender && balance && balance.youOwe > 0) {
        nudgeToastData = {
          senderName: sender.displayName || sender.name,
          amount: balance.youOwe
        };
        showNudgeToast = true;

        // Auto-hide after 8 seconds
        setTimeout(() => {
          showNudgeToast = false;
        }, 8000);
      }
    }
  });

  // The shopping tab links here with ?split=1 after someone picks up items.
  // Nothing is carried across but the intent to split — items are never linked
  // to an expense — so this just opens the form.
  //
  // An $effect rather than onMount, because arriving from the shopping tab is a
  // client-side navigation between two children of the same layout: the page may
  // already be mounted, and onMount would never fire.
  //
  // A latch, not a URL rewrite. Stripping the param with replaceState looked
  // like the tidy option but bought nothing: replaceState updates page.state and
  // the address bar without ever reassigning page.url, so the param stayed
  // readable and any invalidateAll (which SplitCostModal's own submit triggers)
  // re-ran this and reopened the modal over the saved expense. It also throws in
  // dev when an effect outruns router startup. Handling the intent once is both
  // simpler and correct.
  const splitRequested = $derived(page.url.searchParams.get('split') === '1');
  let splitHandled = $state(false);

  $effect(() => {
    if (!splitRequested || splitHandled) return;
    splitHandled = true;
    showSplitCostModal = true;
  });

  // Expense selection state
  let selectedExpenseIds = $state<Set<string>>(new Set());

  function handleSelectionChange(newSelection: Set<string>) {
    selectedExpenseIds = newSelection;
  }

  function handlePayExpensesClick() {
    if (selectedExpenseIds.size > 0) {
      showPayExpensesModal = true;
    }
  }

  function handlePayAll() {
    selectedExpenseIds = allSelectableExpenseIds;
    showPayExpensesModal = true;
  }

  function handlePaymentComplete() {
    selectedExpenseIds = new Set();
  }

  // Expense pagination state
  let allExpenses = $state([...data.expenses]);
  let hasMoreExpenses = $state(data.hasMoreExpenses);

  // Reset expenses when data changes (e.g., after creating new expense)
  $effect(() => {
    allExpenses = [...data.expenses];
    hasMoreExpenses = data.hasMoreExpenses;
  });

  // Every expense the user owes on, from the server rather than the paginated
  // list, so "Pay All Expenses" cannot miss ones on later pages.
  const allSelectableExpenseIds = $derived(
    new Set(
      data.unpaidExpenses
        .filter((e) => {
          const mySplit = e.splits.find((s) => s.userId === data.currentUserId);
          return mySplit !== undefined && !mySplit.hasPaid;
        })
        .map((e) => e.id)
    )
  );

  // One banner per tag the user still owes on. Uses unpaidExpenses rather than
  // the loaded page, so a tagged expense further back still raises its banner.
  const tagDebts = $derived.by(() => {
    const byTag = new Map<
      string,
      { tag: (typeof data.tags)[number]; total: number; ids: string[]; dueDate: string | null }
    >();
    for (const e of data.unpaidExpenses) {
      if (!e.tagId) continue;
      const tag = data.tags.find((t) => t.id === e.tagId);
      if (!tag) continue;
      const mine = e.splits.find((sp) => sp.userId === data.currentUserId);
      if (!mine || mine.hasPaid) continue;
      const entry = byTag.get(tag.id) ?? { tag, total: 0, ids: [], dueDate: null };
      entry.total += shareFor(e, data.currentUserId);
      entry.ids.push(e.id);
      // Several expenses can share a type, so the banner shows the soonest date
      if (e.dueDate && (entry.dueDate === null || e.dueDate < entry.dueDate)) {
        entry.dueDate = e.dueDate;
      }
      byTag.set(tag.id, entry);
    }
    return [...byTag.values()].sort((a, b) => b.total - a.total);
  });

  // Parsed as UTC: a bare "2026-09-01" through the local Date constructor lands
  // on the previous day for anyone west of UTC.
  function formatDueDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function daysUntil(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    const due = Date.UTC(y, m - 1, d);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((due - today) / 86400000);
  }

  function payTag(ids: string[]) {
    selectedExpenseIds = new Set(ids);
    showPayExpensesModal = true;
  }

  // The pay modal resolves each selected id against this array, so it must hold
  // the unpaid expenses even when they are not on the loaded page. Loaded rows
  // win, since they carry the creator object the grid renders.
  const payableExpenses = $derived.by(() => {
    const byId = new Map(data.unpaidExpenses.map((e) => [e.id, e]));
    for (const e of allExpenses) byId.set(e.id, e);
    return [...byId.values()];
  });

  // What the selection actually costs. Reduced over payableExpenses, the same
  // array PayExpensesModal resolves against, so the bar and the modal cannot
  // disagree: allExpenses would miss selections from pages not yet loaded.
  const selectedTotal = $derived(
    payableExpenses
      .filter((e) => selectedExpenseIds.has(e.id))
      .reduce((sum, e) => sum + shareFor(e, data.currentUserId), 0)
  );

  async function loadMoreExpenses() {
    const response = await fetch(
      `/api/household/${data.household.id}/expenses?offset=${allExpenses.length}`
    );
    if (response.ok) {
      const result = await response.json();
      allExpenses = [...allExpenses, ...result.expenses];
      hasMoreExpenses = result.hasMore;
    }
  }

  // Filter out current user from members list (they're the expense creator and already paid)
  const otherMembers = $derived(data.members.filter((m) => m.id !== data.currentUserId));

  // State for including optional expenses in totals/chart
  let includeOptional = $state(false);

  // Calculate totals from balance history, filtering by optional status
  const totalYouOwe = $derived.by(() => {
    const events = includeOptional
      ? data.balanceHistory
      : data.balanceHistory.filter((e) => !e.isOptional);
    return events.reduce((sum, e) => sum + e.youOweChange, 0);
  });
  const totalOwedToYou = $derived.by(() => {
    const events = includeOptional
      ? data.balanceHistory
      : data.balanceHistory.filter((e) => !e.isOptional);
    return events.reduce((sum, e) => sum + e.owedToYouChange, 0);
  });

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Helper to get display name for a member (falls back to user.name)
  function getMemberDisplayName(member: { displayName: string | null; name: string }) {
    return member.displayName || member.name;
  }
</script>

<div class="tab-content">
  <main class="container">
    <!-- Household info first: reference material, separate from expenses -->
    <HouseholdInfoCard
      info={data.household.info}
      householdId={data.household.id}
      isAdmin={data.userRole === 'admin'}
    />

    <!-- Tagged expenses are the ones that cannot slide, so they get said out
         loud rather than being left to find in the grid. -->
    {#each tagDebts as debt (debt.tag.id)}
      <div class="tag-banner" style="--tag-color: {debt.tag.color ?? '#6b7fff'}" role="status">
        <div class="tag-banner-text">
          <strong>{debt.tag.name} due</strong>
          <span>
            You owe {formatCurrency(debt.total)} across {debt.ids.length}
            {debt.ids.length === 1 ? 'expense' : 'expenses'}
          </span>
          {#if debt.dueDate}
            {@const days = daysUntil(debt.dueDate)}
            <span class="tag-due" class:overdue={days < 0} class:soon={days >= 0 && days <= 3}>
              {#if days < 0}
                Was due {formatDueDate(debt.dueDate)}
              {:else if days === 0}
                Due today
              {:else if days === 1}
                Due tomorrow
              {:else}
                Due {formatDueDate(debt.dueDate)}
              {/if}
            </span>
          {/if}
        </div>
        <Button variant="primary" size="sm" on:click={() => payTag(debt.ids)}>
          Pay {debt.tag.name}
        </Button>
      </div>
    {/each}

    <h2 class="section-title">Expenses</h2>

    <!-- Summary Dashboard -->
    <section class="summary-dashboard dashboard-row">
      <!-- padding: none so the toggle can sit flush as a footer bar -->
      <Card padding="none">
        <div class="summary-body">
          <div class="summary-header">
            <div class="summary-heading">
              <h3 class="summary-title">Balance Overview</h3>
              <!-- On the title row rather than its own line: it changes the
                   totals, so it has to stay visible when the chart is
                   collapsed, but it does not deserve a whole line. -->
              <Checkbox bind:checked={includeOptional} label="Include optional" />
            </div>
            <div class="summary-totals">
              <div class="summary-item you-owe">
                <span class="summary-label">You Owe</span>
                <span class="summary-amount">{formatCurrency(totalYouOwe)}</span>
              </div>
              <div class="summary-item owed-to-you">
                <span class="summary-label">You're Owed</span>
                <span class="summary-amount">{formatCurrency(totalOwedToYou)}</span>
              </div>
            </div>
          </div>

          {#if showBalanceHistory}
            <BalanceChart balanceHistory={data.balanceHistory} bind:includeOptional />
          {/if}
        </div>

        <!-- Footer bar, flush to the card edge. Stays at the bottom as the card
             grows, so the control that expanded the chart is where you left it. -->
        <button
          type="button"
          class="history-toggle"
          onclick={() => (showBalanceHistory = !showBalanceHistory)}
          aria-expanded={showBalanceHistory}
        >
          <span class="caret" class:open={showBalanceHistory}>▸</span>
          {showBalanceHistory ? 'Hide Historic Balance' : 'Show Historic Balance'}
        </button>
      </Card>
    </section>

    <!-- Expenses Grid Section -->
    <section class="expenses-grid-section">
      <div class="expenses-header">
        <div class="expenses-actions">
          <div class="primary-cta">
            <Button variant="success" size="sm" on:click={() => (showSplitCostModal = true)}>
              <span class="cta-inner">
                <span class="btn-plus" aria-hidden="true">+</span>
                <span class="cta-text">
                  <span class="cta-title">Split the Cost</span>
                  <span class="cta-subtitle">Split an expense with the household</span>
                </span>
              </span>
            </Button>
          </div>
          {#if isAdmin}
            <button type="button" class="manage-tags" onclick={() => (showTagModal = true)}>
              Priority Expense Types
            </button>
            <!-- One entry point rather than one per member: the import modal
                 already asks who paid. -->
            <button type="button" class="manage-tags" onclick={() => handleImportExpense('')}>
              Import an expense
            </button>
          {/if}
          {#if allSelectableExpenseIds.size > 0}
            <div class="secondary-cta">
              <Button variant="outline" size="sm" on:click={handlePayAll}>
                Pay All Expenses ({allSelectableExpenseIds.size})
              </Button>
            </div>
          {/if}
        </div>
      </div>
      <!-- Who owes whom, between the actions and the list: it is context for
           reading the list, not part of the balance summary above. -->
      <MemberBalanceList
        members={data.members}
        currentUserId={data.currentUserId}
        memberBalances={data.memberBalances}
        nudgesSent={data.nudgesSent}
        onNudge={handleNudge}
      />

      <ExpenseList
        members={data.members}
        expenses={allExpenses}
        hasMore={hasMoreExpenses}
        onLoadMore={loadMoreExpenses}
        currentUserId={data.currentUserId}
        {selectedExpenseIds}
        onSelectionChange={handleSelectionChange}
        allSelectableIds={allSelectableExpenseIds}
        tags={data.tags}
        onEditExpense={handleEditExpense}
        onCancelPayment={handleCancelPayment}
      />
    </section>

    <!-- Members Section (non-admins only — admins manage members in settings) -->
    {#if data.userRole !== 'admin'}
      <section class="members-section">
        <h2>Members</h2>
        <div class="members-grid">
          {#each data.members as member}
            <Card padding="md">
              <div class="member-card">
                <div class="member-info">
                  <h3>
                    {getMemberDisplayName(member)}
                    {#if member.displayName}
                      <span class="original-name">({member.name})</span>
                    {/if}
                  </h3>
                  <p class="member-email">{member.email}</p>
                </div>
                {#if member.role === 'admin'}
                  <Badge variant="primary">Admin</Badge>
                {/if}
              </div>
            </Card>
          {/each}
        </div>
      </section>
    {/if}
  </main>
</div>

<!-- Pay Selected: appears only while rows are selected, floating at the bottom
     centre on every platform so it is reachable without scrolling past the
     table. -->
{#if selectedExpenseIds.size > 0}
  <div class="pay-selected-bar" role="region" aria-label="Selected expenses">
    <Button variant="primary" size="lg" on:click={handlePayExpensesClick}>
      Pay {selectedExpenseIds.size}
      {selectedExpenseIds.size === 1 ? 'expense' : 'expenses'} · {formatCurrency(selectedTotal)}
    </Button>
  </div>
{/if}

{#if isAdmin}
  <TagManagerModal bind:open={showTagModal} tags={data.tags} householdId={data.household.id} />
{/if}

<!-- Split the Cost Modal -->
<SplitCostModal
  bind:open={showSplitCostModal}
  members={otherMembers}
  currentUserId={data.currentUserId}
  tags={data.tags}
  {form}
/>

<!-- Pay Expenses Modal -->
<PayExpensesModal
  bind:open={showPayExpensesModal}
  {selectedExpenseIds}
  expenses={payableExpenses}
  reverseExpenses={data.reverseExpenses}
  members={data.members}
  currentUserId={data.currentUserId}
  onPaymentComplete={handlePaymentComplete}
/>

<!-- Edit Expense Modal -->
<EditExpenseModal
  bind:open={showEditExpenseModal}
  expense={selectedExpenseForEdit}
  members={data.members}
  tags={data.tags}
  onRequestDelete={handleDeleteExpense}
/>

<!-- Delete Expense Modal -->
<DeleteExpenseModal
  bind:open={showDeleteExpenseModal}
  expense={selectedExpenseForDelete}
  members={data.members}
  currentUserId={data.currentUserId}
/>

<!-- Import Expense Modal (Admin Only) -->
{#if data.userRole === 'admin'}
  <ImportExpenseModal
    bind:open={showImportExpenseModal}
    members={data.members}
    defaultCreatorId={importExpenseDefaultCreatorId}
  />
{/if}

<!-- Cancel Payment Modal -->
<CancelPaymentModal
  bind:open={showCancelPaymentModal}
  expense={selectedExpenseForCancelPayment}
  members={data.members}
  currentUserId={data.currentUserId}
/>

<!-- Nudge Modal -->
<NudgeModal
  bind:open={showNudgeModal}
  recipientId={nudgeRecipientId}
  recipientName={nudgeRecipientName}
  amountOwed={nudgeAmountOwed}
  onNudgeSent={handleNudgeSent}
/>

<!-- Nudge Toast Notification -->
{#if showNudgeToast && nudgeToastData}
  <div class="nudge-toast" role="alert">
    <div class="toast-content">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="toast-icon"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <div class="toast-text">
        <strong>{nudgeToastData.senderName}</strong> is requesting payment of
        <strong>{formatCurrency(nudgeToastData.amount)}</strong>
      </div>
    </div>
    <button type="button" class="toast-close" onclick={() => (showNudgeToast = false)}>
      &times;
    </button>
  </div>
{/if}

<style>
  .tab-content {
    /* Header and tabs live in +layout.svelte */
    background-color: var(--color-bg-secondary);
  }

  main {
    padding: var(--space-2xl) var(--space-md) var(--space-md);
  }

  .summary-body {
    padding: var(--space-lg) var(--space-lg) var(--space-md);
  }

  .summary-heading {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  /* Thin footer bar, flush to the card's edges */
  .history-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 38px;
    padding: 0 var(--space-lg);
    border: none;
    border-top: 1px solid var(--color-border);
    /* Matches the card's radius so it does not square off the bottom */
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .history-toggle:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .caret {
    display: inline-block;
    font-size: 0.8rem;
    transition: transform 0.15s ease;
  }

  .caret.open {
    transform: rotate(90deg);
  }

  /* Coloured by the tag itself, so rent and utilities read as different things
     rather than a generic warning */
  .tag-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--tag-color);
    border-left: 4px solid var(--tag-color);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--tag-color) 12%, transparent);
  }

  .tag-banner-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .tag-banner-text strong {
    color: var(--color-text-primary);
    font-size: 0.95rem;
  }

  .tag-due {
    display: inline-block;
    margin-top: 2px;
    padding: 1px 0.45rem;
    border-radius: 999px;
    background-color: color-mix(in srgb, var(--tag-color) 20%, transparent);
    color: var(--color-text-primary);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .tag-due.soon {
    background-color: color-mix(in srgb, var(--color-warning) 26%, transparent);
  }

  .tag-due.overdue {
    background-color: color-mix(in srgb, var(--color-error) 22%, transparent);
    color: var(--color-error);
  }

  .tag-banner-text span {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .section-title {
    margin: var(--space-xl) 0 var(--space-md);
    color: var(--color-text-primary);
  }

  .dashboard-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-md);
  }

  /* Cards must fill their grid cell for the equal-height alignment to show */
  .dashboard-row > :global(.card) {
    display: flex;
    flex-direction: column;
  }

  .dashboard-row > :global(.card) > :global(*:first-child) {
    flex: 1;
  }

  /* Summary Dashboard */
  .summary-dashboard {
    margin-bottom: var(--space-xl);
  }

  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .summary-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .summary-totals {
    display: flex;
    gap: var(--space-lg);
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: right;
  }

  .summary-label {
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-amount {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .summary-item.you-owe .summary-amount {
    color: var(--color-error, #ef4444);
  }

  .summary-item.owed-to-you .summary-amount {
    color: var(--color-success);
  }

  .members-section {
    margin-bottom: var(--space-2xl);
  }

  /* No bottom margin: the grid is the last thing on the page for most users,
     and the expense list already carries its own spacing. */
  .expenses-grid-section {
    margin-bottom: 0;
  }

  .members-section h2 {
    margin: 0 0 var(--space-lg) 0;
    font-size: 1.5rem;
    color: var(--color-text-primary);
  }

  /* Heads both the balance card and the grid, since the balance is expense data */
  .section-title {
    font-size: 1.5rem;
  }

  .expenses-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .expenses-actions {
    display: flex;
    align-items: center;
    /* Left aligned rather than pushed to the right edge, so the CTA sits with
       the heading it belongs to */
    justify-content: flex-start;
    gap: var(--space-md);
    flex-shrink: 0;
  }

  /* The CTA carries real weight on desktop too, not just mobile */
  .primary-cta :global(.btn) {
    min-height: 58px;
    padding: var(--space-sm) var(--space-lg);
  }

  .cta-inner {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .cta-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;
  }

  .cta-title {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .cta-subtitle {
    font-size: 0.78rem;
    font-weight: 500;
    opacity: 0.85;
  }

  .manage-tags {
    flex-shrink: 0;
    min-height: 32px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .manage-tags:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-plus {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .expenses-header :global(.btn) {
    flex-shrink: 0;
    align-self: center;
  }

  .pay-selected-bar {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    /* Clears the iPhone home indicator */
    bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
    z-index: 60;
    display: flex;
    justify-content: center;
  }

  .pay-selected-bar :global(.btn) {
    min-width: 230px;
    min-height: 52px;
    font-size: 1.05rem;
    font-weight: 700;
    border-radius: 999px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  @media (max-width: 767px) {
    .pay-selected-bar {
      left: var(--space-md);
      right: var(--space-md);
      transform: none;
      /* Stacks above the fixed tab bar rather than under it */
      bottom: calc(var(--tabbar-height, 56px) + var(--space-sm) + env(safe-area-inset-bottom));
    }

    .pay-selected-bar :global(.btn) {
      width: 100%;
    }
  }

  .members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-md);
  }

  .member-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }

  .member-info h3 {
    margin: 0 0 var(--space-xs) 0;
    font-size: 1rem;
    color: var(--color-text-primary);
  }

  .member-email {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .original-name {
    font-size: 0.75rem;
    font-weight: normal;
    color: var(--color-text-tertiary);
  }

  @media (max-width: 767px) {
    /* Scaled down across the board. At full size the info card, balance card
       and sticky header filled the viewport before Split the Cost came into
       reach, so everything above the grid gets tighter type and spacing. */
    main {
      /* Just enough to clear the fixed tab bar. The Pay Selected pill floats
         over the content only while rows are selected, so reserving room for
         it permanently left a large empty gap. */
      padding: var(--space-sm) var(--space-sm) var(--space-sm);
    }

    .section-title {
      font-size: 1.15rem;
      margin: var(--space-lg) 0 var(--space-sm);
    }

    .summary-body {
      padding: var(--space-sm) var(--space-md);
    }

    .dashboard-row {
      gap: var(--space-sm);
    }

    .summary-header {
      gap: var(--space-xs);
    }

    .summary-heading {
      gap: var(--space-sm);
    }

    .summary-title {
      font-size: 0.9rem;
    }

    .summary-label {
      font-size: 0.62rem;
    }

    .summary-amount {
      font-size: 1.15rem;
    }

    .summary-totals {
      gap: var(--space-md);
    }

    .history-toggle {
      min-height: 32px;
      font-size: 0.78rem;
    }

    /* The CTA stays large: it is the one thing that should not shrink */
    .expenses-header {
      gap: var(--space-sm);
    }

    .expenses-actions {
      gap: var(--space-md);
    }

    .summary-heading {
      gap: var(--space-sm);
    }

    /* Stack the header so the actions get real width. The Split the Cost CTA
       used to live inside the horizontally scrolling grid as a ~110px cell at
       0.7rem, which could be scrolled off screen entirely. */
    .expenses-header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-sm);
    }

    .expenses-actions {
      flex-direction: column;
      align-items: stretch;
      /* Clear separation: these do very different things and one is
         destructive-adjacent (it opens a payment flow). */
      gap: var(--space-lg);
    }

    .expenses-header :global(.btn) {
      width: 100%;
      align-self: stretch;
    }

    /* The CTA carries the weight; Pay All is contextual and sits quieter */
    .primary-cta :global(.btn) {
      min-height: 62px;
    }

    .primary-cta .cta-inner {
      justify-content: center;
    }

    .secondary-cta :global(.btn) {
      min-height: 44px;
      font-size: 0.95rem;
    }
  }

  /* Nudge Toast Styles */
  .nudge-toast {
    position: fixed;
    top: var(--space-lg);
    right: var(--space-lg);
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    max-width: 400px;
    padding: var(--space-md);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: toastSlideIn 0.3s ease-out;
  }

  @keyframes toastSlideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-content {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .toast-icon {
    width: 24px;
    height: 24px;
    color: var(--color-primary);
    flex-shrink: 0;
  }

  .toast-text {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    line-height: 1.4;
  }

  .toast-text strong {
    color: var(--color-primary);
  }

  .toast-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-tertiary);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .toast-close:hover {
    color: var(--color-text-primary);
  }
</style>
