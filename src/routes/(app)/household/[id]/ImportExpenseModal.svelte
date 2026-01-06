<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import { enhance } from '$app/forms';

  type Member = {
    id: string;
    name: string;
    displayName: string | null;
  };

  let {
    open = $bindable(false),
    members = [],
    defaultCreatorId = ''
  }: {
    open: boolean;
    members: Member[];
    defaultCreatorId: string;
  } = $props();

  // Form state
  let creatorId = $state('');
  let amount = $state('');
  let description = $state('');
  let expenseDate = $state('');
  let isOptional = $state(false);
  let selectedMembers = $state<string[]>([]);
  let paidMembers = $state<string[]>([]);
  let paidDates = $state<Record<string, string>>({});
  let selectAll = $state(true);

  // Initialize form when modal opens
  $effect(() => {
    if (open) {
      creatorId = defaultCreatorId || (members.length > 0 ? members[0].id : '');
      expenseDate = new Date().toISOString().split('T')[0];
      amount = '';
      description = '';
      isOptional = false;
      paidMembers = [];
      paidDates = {};
      // Initialize splits with all other members
      const others = members.filter((m) => m.id !== creatorId);
      selectedMembers = others.map((m) => m.id);
      selectAll = others.length > 0;
    }
  });

  // Get members excluding current creator
  const otherMembers = $derived(members.filter((m) => m.id !== creatorId));

  // When creator changes, reset splits
  let previousCreatorId = $state('');
  $effect(() => {
    if (creatorId && creatorId !== previousCreatorId) {
      previousCreatorId = creatorId;
      const others = members.filter((m) => m.id !== creatorId);
      selectedMembers = others.map((m) => m.id);
      paidMembers = [];
      paidDates = {};
      selectAll = others.length > 0;
    }
  });

  // Sync selectAll state
  $effect(() => {
    if (otherMembers.length > 0) {
      const allSelected = selectedMembers.length === otherMembers.length;
      if (selectAll !== allSelected) {
        selectAll = allSelected;
      }
    }
  });

  function getMemberDisplayName(member: Member) {
    return member.displayName || member.name;
  }

  function toggleMember(memberId: string) {
    if (selectedMembers.includes(memberId)) {
      selectedMembers = selectedMembers.filter((id) => id !== memberId);
      // Also remove from paid and clear date
      paidMembers = paidMembers.filter((id) => id !== memberId);
      const { [memberId]: _, ...rest } = paidDates;
      paidDates = rest;
    } else {
      selectedMembers = [...selectedMembers, memberId];
    }
  }

  function togglePaidMember(memberId: string) {
    if (paidMembers.includes(memberId)) {
      paidMembers = paidMembers.filter((id) => id !== memberId);
      // Clear the date when unchecking
      const { [memberId]: _, ...rest } = paidDates;
      paidDates = rest;
    } else {
      paidMembers = [...paidMembers, memberId];
    }
  }

  function updatePaidDate(memberId: string, date: string) {
    paidDates = { ...paidDates, [memberId]: date };
  }

  function handleSelectAllChange() {
    if (selectAll) {
      selectedMembers = otherMembers.map((m) => m.id);
    } else {
      selectedMembers = [];
      paidMembers = [];
      paidDates = {};
    }
  }

  function handleClose() {
    open = false;
  }
</script>

<Modal bind:open title="Import Expense" size="md">
  {#snippet children()}
    <form
      method="POST"
      action="?/importExpense"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
          handleClose();
        };
      }}
      id="import-expense-form"
    >
      <!-- Creator Selection -->
      <div class="form-group">
        <label class="form-label" for="creator">Who paid for this expense?</label>
        <select id="creator" name="creatorId" class="select-input" required bind:value={creatorId}>
          {#each members as member}
            <option value={member.id}>{getMemberDisplayName(member)}</option>
          {/each}
        </select>
      </div>

      <!-- Amount -->
      <div class="form-group">
        <Input
          type="number"
          name="amount"
          label="Amount"
          placeholder="0.00"
          step="0.01"
          min="0.01"
          required
          bind:value={amount}
        />
      </div>

      <!-- Description -->
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

      <!-- Date -->
      <div class="form-group">
        <Input type="date" name="expenseDate" label="Date" required bind:value={expenseDate} />
      </div>

      <!-- Split With -->
      {#if otherMembers.length > 0}
        <div class="form-group">
          <span class="form-label">Split with</span>
          <div class="members-select">
            <div class="select-all-option">
              <Checkbox
                bind:checked={selectAll}
                on:change={handleSelectAllChange}
                label="Everyone else"
              />
            </div>
            <div class="members-checkboxes">
              {#each otherMembers as member}
                {@const isInSplit = selectedMembers.includes(member.id)}
                {@const hasPaid = paidMembers.includes(member.id)}
                <div class="member-row">
                  <div class="member-split-checkbox">
                    <Checkbox
                      name="splitWith"
                      value={member.id}
                      checked={isInSplit}
                      on:change={() => toggleMember(member.id)}
                      label={getMemberDisplayName(member)}
                    />
                  </div>
                  {#if isInSplit}
                    <div class="paid-controls">
                      <div class="paid-checkbox">
                        <Checkbox
                          name="paidMembers"
                          value={member.id}
                          checked={hasPaid}
                          on:change={() => togglePaidMember(member.id)}
                          label="Already paid"
                        />
                      </div>
                      {#if hasPaid}
                        <input
                          type="date"
                          name="paidDate_{member.id}"
                          class="paid-date-input"
                          value={paidDates[member.id] || ''}
                          oninput={(e) => updatePaidDate(member.id, e.currentTarget.value)}
                          placeholder="Payment date"
                        />
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <p class="solo-notice">
          {getMemberDisplayName(members.find((m) => m.id === creatorId) || members[0])}
          is the only member. This expense will be tracked for their records.
        </p>
      {/if}

      <!-- Optional Flag -->
      <div class="form-group">
        <Checkbox
          name="isOptional"
          bind:checked={isOptional}
          label="Optional expense (people can choose to pay)"
        />
      </div>
    </form>
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Cancel</Button>
    <Button type="submit" variant="secondary" form="import-expense-form">Import Expense</Button>
  {/snippet}
</Modal>

<style>
  .form-group {
    margin-bottom: var(--space-lg);
  }

  .form-label {
    display: block;
    margin-bottom: var(--space-sm);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .select-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: var(--font-sans);
    color: var(--color-text-primary);
    background-color: var(--color-bg-primary);
    cursor: pointer;
  }

  .select-input:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(107, 127, 255, 0.1);
  }

  .members-select {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .select-all-option {
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--color-border);
  }

  .members-checkboxes {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .member-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
  }

  .member-split-checkbox {
    flex: 1;
    min-width: 120px;
  }

  .paid-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-xs);
  }

  .paid-checkbox :global(.checkbox-group) {
    gap: var(--space-xs);
  }

  .paid-checkbox :global(.checkbox) {
    width: 1rem;
    height: 1rem;
  }

  .paid-checkbox :global(.label) {
    font-size: 0.75rem;
    color: var(--color-success);
  }

  .paid-date-input {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-family: var(--font-sans);
    color: var(--color-text-primary);
    background-color: var(--color-bg-primary);
    width: 130px;
  }

  .paid-date-input:focus {
    outline: none;
    border-color: var(--color-success);
  }

  .solo-notice {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: var(--space-md) 0;
  }
</style>
