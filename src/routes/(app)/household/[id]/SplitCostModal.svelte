<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import { enhance } from '$app/forms';

  let {
    open = $bindable(false),
    members = []
  }: {
    open: boolean;
    members: Array<{ id: string; name: string; displayName: string | null }>;
  } = $props();

  let selectedMembers = $state<string[]>([]);
  let isOptional = $state(false);
  let selectAll = $state(true);

  // Initialize with all members selected when modal opens
  $effect(() => {
    if (open && members.length > 0 && selectedMembers.length === 0) {
      selectedMembers = members.map((m) => m.id);
      selectAll = true;
    }
  });

  // Sync selectAll state when individual selections change
  $effect(() => {
    const allSelected = members.length > 0 && selectedMembers.length === members.length;
    if (selectAll !== allSelected) {
      selectAll = allSelected;
    }
  });

  function getMemberDisplayName(member: { name: string; displayName: string | null }) {
    return member.displayName || member.name;
  }

  function toggleMember(memberId: string) {
    if (selectedMembers.includes(memberId)) {
      selectedMembers = selectedMembers.filter((id) => id !== memberId);
    } else {
      selectedMembers = [...selectedMembers, memberId];
    }
  }

  function handleSelectAllChange() {
    if (selectAll) {
      // Was just checked, select all members
      selectedMembers = members.map((m) => m.id);
    } else {
      // Was just unchecked, deselect all members
      selectedMembers = [];
    }
  }

  function handleClose() {
    open = false;
    isOptional = false;
    selectedMembers = [];
    selectAll = true;
  }
</script>

<Modal bind:open title="Split the Cost" size="md">
  {#snippet children()}
    <form
      method="POST"
      action="?/createExpense"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
          handleClose();
        };
      }}
      id="expense-form"
    >
      <div class="form-group">
        <Input
          type="number"
          name="amount"
          label="Amount"
          placeholder="0.00"
          step="0.01"
          min="0.01"
          required
        />
      </div>

      <div class="form-group">
        <Textarea
          name="description"
          label="Description"
          placeholder="What's this expense for?"
          required
          rows={3}
        />
      </div>

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
            {#each members as member}
              {@const isChecked = selectedMembers.includes(member.id)}
              <Checkbox
                name="splitWith"
                value={member.id}
                checked={isChecked}
                on:change={() => toggleMember(member.id)}
                label={getMemberDisplayName(member)}
              />
            {/each}
          </div>
        </div>
      </div>

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
    <Button type="submit" variant="primary" form="expense-form">Create Expense</Button>
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
</style>
