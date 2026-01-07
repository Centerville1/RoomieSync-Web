<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Card from '$lib/components/Card.svelte';
  import { enhance } from '$app/forms';

  let {
    open = $bindable(false),
    pendingInvites = [],
    form
  }: {
    open: boolean;
    pendingInvites: Array<{ id: string; invitedEmail: string; createdAt: Date }>;
    form?: { error?: string; emailFailed?: boolean; emailSent?: boolean; resent?: boolean } | null;
  } = $props();

  let inviteEmail = $state('');
  let resendingId = $state<string | null>(null);
  let resendSuccess = $state<string | null>(null);
  let resendError = $state<string | null>(null);

  function handleClose() {
    open = false;
    inviteEmail = '';
    resendSuccess = null;
    resendError = null;
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
            inviteEmail = '';
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
          Enter the email address of the person you want to invite. They'll receive an email with a
          link to join.
        </p>
      </div>

      {#if form?.error}
        <p class="error-message">{form.error}</p>
      {/if}

      {#if form?.emailSent}
        <p class="success-message">Invite sent successfully! An email has been sent.</p>
      {/if}

      {#if form?.emailFailed}
        <p class="warning-message">
          Invite created, but the email failed to send. You can try resending it below.
        </p>
      {/if}
    </form>

    <!-- Pending Invites Section -->
    {#if pendingInvites.length > 0}
      <div class="pending-invites-section">
        <h3>Pending Invites</h3>

        {#if resendSuccess}
          <p class="success-message">{resendSuccess}</p>
        {/if}

        {#if resendError}
          <p class="error-message">{resendError}</p>
        {/if}

        <div class="pending-invites-list">
          {#each pendingInvites as invite}
            <Card padding="md">
              <div class="pending-invite-card">
                <div class="invite-details">
                  <p class="invite-email">{invite.invitedEmail}</p>
                  <p class="invite-date">Invited {formatDate(invite.createdAt)}</p>
                </div>
                <div class="invite-actions">
                  <form
                    method="POST"
                    action="?/resendInvite"
                    use:enhance={() => {
                      resendingId = invite.id;
                      resendSuccess = null;
                      resendError = null;
                      return async ({ result, update }) => {
                        resendingId = null;
                        if (result.type === 'success') {
                          resendSuccess = `Email resent to ${invite.invitedEmail}`;
                        } else if (result.type === 'failure') {
                          resendError =
                            (result.data as { error?: string })?.error || 'Failed to resend email';
                        }
                        await update({ reset: false });
                      };
                    }}
                  >
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      disabled={resendingId === invite.id}
                    >
                      {resendingId === invite.id ? 'Sending...' : 'Resend'}
                    </Button>
                  </form>
                  <form method="POST" action="?/cancelInvite" use:enhance>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <Button type="submit" variant="outline" size="sm">Cancel</Button>
                  </form>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Close</Button>
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

  .error-message {
    margin: var(--space-md) 0 0 0;
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
  }

  .success-message {
    margin: var(--space-md) 0 0 0;
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #16a34a);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
  }

  .warning-message {
    margin: var(--space-md) 0 0 0;
    padding: var(--space-sm) var(--space-md);
    background-color: var(--color-warning-bg, #fffbeb);
    color: var(--color-warning, #d97706);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
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

  .invite-actions {
    display: flex;
    gap: var(--space-xs);
  }
</style>
