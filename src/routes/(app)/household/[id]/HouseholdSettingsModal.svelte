<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  type Member = {
    id: string;
    name: string;
    email: string;
    role: string;
    displayName: string | null;
  };

  let {
    open = $bindable(false),
    householdName = '',
    householdId = '',
    members = [],
    currentUserId = ''
  }: {
    open: boolean;
    householdName: string;
    householdId: string;
    members: Member[];
    currentUserId: string;
  } = $props();

  // Actions live on the expenses page; this modal renders from the household
  // layout, so address them absolutely rather than relying on the current tab.
  const actionBase = $derived(`/household/${householdId}`);

  let newName = $state('');
  let showDeleteConfirm = $state(false);
  let deleteConfirmText = $state('');
  let isSubmitting = $state(false);
  let editingMemberId = $state<string | null>(null);
  let editDisplayName = $state('');
  let kickingMemberId = $state<string | null>(null);

  // Reset state when modal opens
  $effect(() => {
    if (open) {
      newName = householdName;
      showDeleteConfirm = false;
      deleteConfirmText = '';
      isSubmitting = false;
      editingMemberId = null;
      editDisplayName = '';
      kickingMemberId = null;
    }
  });

  const canDelete = $derived(deleteConfirmText === householdName);
  const nameChanged = $derived(newName.trim() !== '' && newName.trim() !== householdName);

  function getMemberDisplayName(member: Member) {
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

  function handleClose() {
    open = false;
  }
</script>

<Modal bind:open title="Household Settings" size="md">
  {#snippet children()}
    <div class="settings-sections">
      <!-- Rename Section -->
      <section class="settings-section">
        <h3>Rename Household</h3>
        <form
          method="POST"
          action="{actionBase}?/renameHousehold"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ result }) => {
              if (result.type !== 'redirect') await invalidateAll();
              await applyAction(result);
              isSubmitting = false;
              handleClose();
            };
          }}
          class="rename-form"
        >
          <Input
            name="name"
            label="Household name"
            bind:value={newName}
            placeholder="Enter new name"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!nameChanged || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </form>
      </section>

      <!-- Members Section -->
      <section class="settings-section">
        <h3>Members ({members.length})</h3>
        <div class="members-list">
          {#each members as member}
            <div class="member-row" class:kicking={kickingMemberId === member.id}>
              <div class="member-main">
                {#if editingMemberId === member.id}
                  <form
                    method="POST"
                    action="{actionBase}?/updateDisplayName"
                    class="edit-name-inline"
                    use:enhance={() => {
                      return async ({ result }) => {
                        if (result.type !== 'redirect') await invalidateAll();
                        await applyAction(result);
                        cancelEditingDisplayName();
                      };
                    }}
                  >
                    <input type="hidden" name="memberId" value={member.id} />
                    <div class="edit-name-row">
                      <Input
                        name="displayName"
                        bind:value={editDisplayName}
                        placeholder={member.name}
                      />
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
                  <div class="member-info">
                    <span class="member-name">
                      {getMemberDisplayName(member)}
                      {#if member.displayName}
                        <span class="original-name">({member.name})</span>
                      {/if}
                      {#if member.id === currentUserId}
                        <span class="you-tag">(You)</span>
                      {/if}
                    </span>
                    <span class="member-email">{member.email}</span>
                  </div>
                  <div class="member-actions">
                    {#if member.role === 'admin'}
                      <Badge variant="primary">Admin</Badge>
                    {/if}
                    {#if member.id !== currentUserId}
                      <button
                        type="button"
                        class="action-link"
                        onclick={() => startEditingDisplayName(member.id, member.displayName)}
                      >
                        Edit display name
                      </button>
                      <button
                        type="button"
                        class="action-link danger"
                        onclick={() => (kickingMemberId = member.id)}
                      >
                        Kick
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Kick confirmation -->
              {#if kickingMemberId === member.id}
                <div class="kick-confirm">
                  <p class="kick-warning">
                    Remove <strong>{getMemberDisplayName(member)}</strong> from this household? This will
                    delete all their expense and payment data. This cannot be undone.
                  </p>
                  <div class="kick-actions">
                    <form
                      method="POST"
                      action="{actionBase}?/kickMember"
                      use:enhance={() => {
                        isSubmitting = true;
                        return async ({ result }) => {
                          if (result.type !== 'redirect') await invalidateAll();
                          await applyAction(result);
                          isSubmitting = false;
                          kickingMemberId = null;
                        };
                      }}
                    >
                      <input type="hidden" name="memberId" value={member.id} />
                      <Button type="submit" variant="danger" size="sm" disabled={isSubmitting}>
                        {isSubmitting ? 'Removing...' : 'Remove Member'}
                      </Button>
                    </form>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      on:click={() => (kickingMemberId = null)}>Cancel</Button
                    >
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>

      <!-- Danger Zone -->
      <section class="settings-section danger-zone">
        <h3>Danger Zone</h3>
        {#if !showDeleteConfirm}
          <p class="danger-description">
            Deleting this household will permanently remove all expenses, members, and data. This
            cannot be undone.
          </p>
          <Button variant="danger" size="sm" on:click={() => (showDeleteConfirm = true)}>
            Delete Household
          </Button>
        {:else}
          <div class="delete-confirm">
            <p class="danger-warning">
              This action is <strong>permanent and irreversible</strong>. All expenses, payment
              history, and member data will be deleted.
            </p>
            <p class="confirm-instruction">
              Type <strong>{householdName}</strong> to confirm:
            </p>
            <Input name="confirmName" bind:value={deleteConfirmText} placeholder={householdName} />
            <div class="delete-actions">
              <form
                method="POST"
                action="{actionBase}?/deleteHousehold"
                use:enhance={() => {
                  isSubmitting = true;
                  return async ({ result }) => {
                    if (result.type !== 'redirect') await invalidateAll();
                    await applyAction(result);
                    isSubmitting = false;
                  };
                }}
              >
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={!canDelete || isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Permanently Delete'}
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                on:click={() => {
                  showDeleteConfirm = false;
                  deleteConfirmText = '';
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        {/if}
      </section>
    </div>
  {/snippet}
</Modal>

<style>
  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .settings-section h3 {
    margin: 0 0 var(--space-md) 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .rename-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    align-items: flex-start;
  }

  .rename-form :global(.input-wrapper) {
    width: 100%;
  }

  /* Members list */
  .members-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .member-row {
    border-bottom: 1px solid var(--color-border);
  }

  .member-row:last-child {
    border-bottom: none;
  }

  .member-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    gap: var(--space-md);
  }

  .member-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .member-name {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--color-text-primary);
  }

  .original-name {
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
  }

  .you-tag {
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
  }

  .member-email {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .member-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .action-link {
    background: none;
    border: none;
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-primary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background-color 0.15s ease;
  }

  .action-link:hover {
    background-color: var(--color-bg-tertiary);
  }

  .action-link.danger {
    color: var(--color-error, #ef4444);
  }

  .action-link.danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  /* Edit display name inline */
  .edit-name-inline {
    width: 100%;
  }

  .edit-name-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-sm);
  }

  .edit-name-row :global(.input-wrapper) {
    flex: 1;
  }

  /* Kick confirmation */
  .member-row.kicking {
    background-color: rgba(239, 68, 68, 0.04);
  }

  .kick-confirm {
    padding: 0 var(--space-md) var(--space-md);
  }

  .kick-warning {
    margin: 0 0 var(--space-sm) 0;
    font-size: 0.8rem;
    color: var(--color-error, #ef4444);
    line-height: 1.5;
  }

  .kick-actions {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
  }

  /* Danger Zone */
  .danger-zone {
    padding: var(--space-md);
    border: 1px solid var(--color-error, #ef4444);
    border-radius: var(--radius-md);
    background-color: rgba(239, 68, 68, 0.04);
  }

  .danger-zone h3 {
    color: var(--color-error, #ef4444);
  }

  .danger-description {
    margin: 0 0 var(--space-md) 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .danger-warning {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-error, #ef4444);
    line-height: 1.5;
  }

  .confirm-instruction {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .delete-actions {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
  }
</style>
