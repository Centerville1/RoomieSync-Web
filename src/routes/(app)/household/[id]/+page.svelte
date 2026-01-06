<script lang="ts">
  import type { PageData } from './$types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Input from '$lib/components/Input.svelte';
  import InviteMemberModal from './InviteMemberModal.svelte';
  import SplitCostModal from './SplitCostModal.svelte';
  import PayExpensesModal from './PayExpensesModal.svelte';
  import EditExpenseModal from './EditExpenseModal.svelte';
  import DeleteExpenseModal from './DeleteExpenseModal.svelte';
  import ImportExpenseModal from './ImportExpenseModal.svelte';
  import ExpenseGrid from './ExpenseGrid.svelte';
  import BalanceChart from './BalanceChart.svelte';

  let { data }: { data: PageData } = $props();
  let showSplitCostModal = $state(false);
  let showInviteModal = $state(false);
  let showPayExpensesModal = $state(false);
  let showEditExpenseModal = $state(false);
  let showDeleteExpenseModal = $state(false);
  let showImportExpenseModal = $state(false);
  let importExpenseDefaultCreatorId = $state('');
  let editingMemberId = $state<string | null>(null);
  let editDisplayName = $state('');

  // Expense being edited/deleted
  type Expense = {
    id: string;
    description: string;
    amount: number;
    isOptional: boolean;
    creatorId: string;
    createdAt: Date;
    splits: { userId: string; hasPaid: boolean; paidAt: Date | null }[];
  };
  let selectedExpenseForEdit = $state<Expense | null>(null);
  let selectedExpenseForDelete = $state<Expense | null>(null);

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

  function startEditingDisplayName(memberId: string, currentDisplayName: string | null) {
    editingMemberId = memberId;
    editDisplayName = currentDisplayName || '';
  }

  function cancelEditingDisplayName() {
    editingMemberId = null;
    editDisplayName = '';
  }
</script>

<div class="household-container">
  <!-- Main Navigation (same as home page) -->
  <nav class="navbar">
    <div class="container">
      <div class="nav-left">
        <a href="/" class="logo-container">
          <img src="/icon-nobg.png" alt="RoomieSync" class="logo-icon" />
          <h2 class="logo">RoomieSync</h2>
        </a>
        <a href="/" class="back-link">
          <Button variant="ghost" size="sm">← Back to Households</Button>
        </a>
      </div>
      <div class="nav-links">
        <span>Welcome, {data.userName}!</span>
        <form method="POST" action="/logout">
          <Button variant="outline" type="submit">Sign Out</Button>
        </form>
      </div>
    </div>
  </nav>

  <!-- Household Header -->
  <header class="household-header">
    {#if data.household.bannerUrl}
      <div class="banner" style="background-image: url({data.household.bannerUrl})"></div>
    {/if}
    <div class="header-content container">
      {#if data.household.imageUrl}
        <img src={data.household.imageUrl} alt={data.household.name} class="household-avatar" />
      {/if}
      <div class="header-info">
        <h1>{data.household.name}</h1>
        <p>{data.members.length} {data.members.length === 1 ? 'member' : 'members'}</p>
      </div>
      <div class="header-actions">
        {#if data.userRole === 'admin'}
          <Button variant="secondary" size="lg" on:click={() => (showInviteModal = true)}
            >Invite Members</Button
          >
        {/if}
      </div>
    </div>
  </header>

  <main class="container">
    <!-- Summary Dashboard -->
    <section class="summary-dashboard">
      <Card padding="md">
        <div class="summary-header">
          <h3 class="summary-title">Balance Overview</h3>
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
        <BalanceChart balanceHistory={data.balanceHistory} bind:includeOptional />
      </Card>
    </section>

    <!-- Expenses Grid Section -->
    <section class="expenses-grid-section">
      <h2>Expenses</h2>
      <p class="expense-helper-text">Click on red rows to select expenses to pay</p>
      <ExpenseGrid
        members={data.members}
        expenses={allExpenses}
        hasMore={hasMoreExpenses}
        onLoadMore={loadMoreExpenses}
        currentUserId={data.currentUserId}
        {selectedExpenseIds}
        onSelectionChange={handleSelectionChange}
        memberBalances={data.memberBalances}
        onEditExpense={handleEditExpense}
        onDeleteExpense={handleDeleteExpense}
        onSplitCost={() => (showSplitCostModal = true)}
        isAdmin={data.userRole === 'admin'}
        onImportExpense={handleImportExpense}
      />
      <div class="pay-button-container">
        <Button
          variant="primary"
          size="lg"
          on:click={handlePayExpensesClick}
          disabled={selectedExpenseIds.size === 0}
        >
          Pay Expenses{selectedExpenseIds.size > 0 ? ` (${selectedExpenseIds.size})` : ''}
        </Button>
      </div>
    </section>

    <!-- Members Section -->
    <section class="members-section">
      <h2>Members</h2>
      <div class="members-grid">
        {#each data.members as member}
          <Card padding="md">
            <div class="member-card">
              <div class="member-info">
                {#if editingMemberId === member.id}
                  <form method="POST" action="?/updateDisplayName" class="edit-display-name-form">
                    <input type="hidden" name="memberId" value={member.id} />
                    <Input
                      name="displayName"
                      placeholder={member.name}
                      bind:value={editDisplayName}
                    />
                    <div class="edit-actions">
                      <Button type="submit" variant="primary" size="sm">Save</Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        on:click={cancelEditingDisplayName}>Cancel</Button
                      >
                    </div>
                  </form>
                {:else}
                  <h3>
                    {getMemberDisplayName(member)}
                    {#if member.displayName}
                      <span class="original-name">({member.name})</span>
                    {/if}
                  </h3>
                  <p class="member-email">{member.email}</p>
                  {#if data.userRole === 'admin'}
                    <button
                      class="edit-name-btn"
                      onclick={() => startEditingDisplayName(member.id, member.displayName)}
                    >
                      Edit display name
                    </button>
                  {/if}
                {/if}
              </div>
              {#if member.role === 'admin'}
                <Badge variant="primary">Admin</Badge>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    </section>
  </main>
</div>

<!-- Split the Cost Modal -->
<SplitCostModal bind:open={showSplitCostModal} members={otherMembers} />

<!-- Pay Expenses Modal -->
<PayExpensesModal
  bind:open={showPayExpensesModal}
  {selectedExpenseIds}
  expenses={allExpenses}
  members={data.members}
  currentUserId={data.currentUserId}
  onPaymentComplete={handlePaymentComplete}
/>

<!-- Invite Member Modal -->
<InviteMemberModal bind:open={showInviteModal} pendingInvites={data.pendingInvites} />

<!-- Edit Expense Modal -->
<EditExpenseModal
  bind:open={showEditExpenseModal}
  expense={selectedExpenseForEdit}
  members={data.members}
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

<style>
  .household-container {
    min-height: 100vh;
    background-color: var(--color-bg-secondary);
  }

  /* Main Navigation */
  .navbar {
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    padding: var(--space-md) 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .navbar .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
  }

  .logo-container {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    text-decoration: none;
  }

  .logo-icon {
    height: 3.5rem;
  }

  .logo {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  .back-link {
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: var(--space-md);
    align-items: center;
  }

  /* Household Header */
  .household-header {
    background-color: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    position: relative;
  }

  .banner {
    width: 100%;
    height: 12rem;
    background-size: cover;
    background-position: center;
    background-color: var(--color-bg-tertiary);
  }

  .header-content {
    padding: var(--space-xl);
    display: flex;
    gap: var(--space-lg);
    align-items: center;
    flex-wrap: wrap;
  }

  .household-avatar {
    width: 6rem;
    height: 6rem;
    border-radius: var(--radius-lg);
    object-fit: cover;
    background-color: var(--color-bg-tertiary);
    border: 4px solid var(--color-bg-primary);
  }

  .header-info {
    flex: 1;
    min-width: 200px;
  }

  .header-info h1 {
    margin: 0 0 var(--space-xs) 0;
    font-size: 2rem;
    color: var(--color-text-primary);
  }

  .header-info p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .header-actions {
    display: flex;
    gap: var(--space-md);
  }

  main {
    padding: var(--space-2xl) var(--space-md);
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

  .expenses-grid-section,
  .members-section {
    margin-bottom: var(--space-2xl);
  }

  .expenses-grid-section h2,
  .members-section h2 {
    margin: 0 0 var(--space-lg) 0;
    font-size: 1.5rem;
    color: var(--color-text-primary);
  }

  .expense-helper-text {
    margin: 0 0 var(--space-md) 0;
    font-size: 0.875rem;
    color: var(--color-error, #ef4444);
  }

  .pay-button-container {
    display: flex;
    justify-content: center;
  }

  .pay-button-container :global(button) {
    min-width: 200px;
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

  .edit-name-btn {
    background: none;
    border: none;
    padding: 0;
    margin-top: var(--space-xs);
    font-size: 0.75rem;
    color: var(--color-primary);
    cursor: pointer;
    text-decoration: underline;
  }

  .edit-name-btn:hover {
    color: var(--color-primary-hover);
  }

  .edit-display-name-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .edit-actions {
    display: flex;
    gap: var(--space-xs);
  }

  @media (max-width: 768px) {
    .nav-left {
      gap: var(--space-sm);
    }

    .logo {
      display: none;
    }

    .nav-links span {
      display: none;
    }

    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions :global(button) {
      width: 100%;
    }

    .header-info h1 {
      font-size: 1.5rem;
    }
  }
</style>
