<script lang="ts">
  import Checkbox from './Checkbox.svelte';

  type Member = {
    id: string;
    name: string;
    displayName: string | null;
  };

  let {
    members = [],
    selectedMembers = $bindable<string[]>([]),
    label = 'Split with',
    selectAllLabel = 'Everyone else',
    name = 'splitWith',
    initializeAll = true,
    memberExtra
  }: {
    members: Member[];
    selectedMembers?: string[];
    label?: string;
    selectAllLabel?: string;
    name?: string;
    initializeAll?: boolean;
    memberExtra?: import('svelte').Snippet<[{ member: Member; isChecked: boolean }]>;
  } = $props();

  let selectAll = $state(false);
  let hasInitialized = $state(false);

  // Initialize with all members selected on first render (if initializeAll is true)
  $effect(() => {
    if (initializeAll && members.length > 0 && !hasInitialized) {
      selectedMembers = members.map((m) => m.id);
      selectAll = true;
      hasInitialized = true;
    }
  });

  // Sync selectAll state when individual selections change
  $effect(() => {
    const allSelected = members.length > 0 && selectedMembers.length === members.length;
    if (selectAll !== allSelected) {
      selectAll = allSelected;
    }
  });

  function getMemberDisplayName(member: Member) {
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
</script>

{#if members.length > 0}
  <div class="member-select">
    <span class="form-label">{label}</span>
    <div class="members-container">
      <div class="select-all-option">
        <Checkbox
          bind:checked={selectAll}
          on:change={handleSelectAllChange}
          label={selectAllLabel}
        />
      </div>
      <div class="members-checkboxes">
        {#each members as member (member.id)}
          {@const isChecked = selectedMembers.includes(member.id)}
          <div class="member-row">
            <Checkbox
              {name}
              value={member.id}
              checked={isChecked}
              on:change={() => toggleMember(member.id)}
              label={getMemberDisplayName(member)}
            />
            {#if memberExtra}
              {@render memberExtra({ member, isChecked })}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .member-select {
    margin-bottom: var(--space-lg);
  }

  .form-label {
    display: block;
    margin-bottom: var(--space-sm);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .members-container {
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
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
</style>
