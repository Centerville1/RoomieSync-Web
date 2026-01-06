<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Card from '$lib/components/Card.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { enhance } from '$app/forms';

  let {
    open = $bindable(false),
    pendingInvites = []
  }: {
    open: boolean;
    pendingInvites: Array<{ id: string; invitedEmail: string; createdAt: Date }>;
  } = $props();

  let inviteEmail = $state('');

  function handleClose() {
    open = false;
    inviteEmail = '';
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  }
</script>

<Modal bind:open title="Invite Member" size="md">
  {#snippet children()}
    <form
      method="POST"
      action="?/inviteMember"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success') {
            handleClose();
          }
        };
      }}
      id="invite-form"
    >
      <div class="form-group">
        <Input
          type="email"
          name="email"
          label="Email Address"
          bind:value={inviteEmail}
          placeholder="roommate@example.com"
          required
        />
        <p class="help-text">
          Enter the email address of the person you want to invite. They'll see the invite when they
          log in.
        </p>
      </div>
    </form>

    <!-- Pending Invites Section -->
    {#if pendingInvites.length > 0}
      <div class="pending-invites-section">
        <h3>Pending Invites</h3>
        <div class="pending-invites-list">
          {#each pendingInvites as invite}
            <Card padding="md">
              <div class="pending-invite-card">
                <div class="invite-details">
                  <p class="invite-email">{invite.invitedEmail}</p>
                  <p class="invite-date">Invited {formatDate(invite.createdAt)}</p>
                </div>
                <form method="POST" action="?/cancelInvite" use:enhance>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <Button type="submit" variant="outline" size="sm">Cancel</Button>
                </form>
              </div>
            </Card>
          {/each}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Cancel</Button>
    <Button type="submit" variant="primary" form="invite-form">Send Invite</Button>
  {/snippet}
</Modal>

<style>
  .form-group {
    margin-bottom: var(--space-lg);
  }

  .help-text {
    margin-top: var(--space-xs);
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .pending-invites-section {
    margin-top: var(--space-2xl);
    padding-top: var(--space-xl);
    border-top: 1px solid var(--color-border);
  }

  .pending-invites-section h3 {
    margin: 0 0 var(--space-md) 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .pending-invites-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .pending-invite-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }

  .invite-details {
    flex: 1;
  }

  .invite-email {
    margin: 0 0 var(--space-xs) 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .invite-date {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }
</style>
