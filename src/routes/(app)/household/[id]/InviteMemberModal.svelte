<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import { enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  type Suggestion = { id: string; name: string; email: string };

  let {
    open = $bindable(false),
    pendingInvites = [],
    householdId,
    suggestions = [],
    form
  }: {
    open: boolean;
    pendingInvites: Array<{ id: string; invitedEmail: string; createdAt: Date }>;
    householdId: string;
    /** People from the admin's other households, already filtered server-side */
    suggestions?: Suggestion[];
    form?: { error?: string; emailFailed?: boolean; emailSent?: boolean; resent?: boolean } | null;
  } = $props();

  // Actions live on the expenses page, so they are addressed absolutely: this
  // modal renders from the household layout and can be open on any tab.
  const actionBase = $derived(`/household/${householdId}`);

  let inviteEmail = $state('');
  let showSuggestions = $state(false);

  // Matches on name or email, anywhere in the string, so "tim" and "gmail"
  // both narrow the list. Prefix matches rank first.
  const matches = $derived.by(() => {
    const q = inviteEmail.trim().toLowerCase();
    const ranked = suggestions
      .map((s) => {
        const name = s.name.toLowerCase();
        const email = s.email.toLowerCase();
        if (q.length === 0) return { s, at: 0 };
        const at = Math.min(
          name.includes(q) ? name.indexOf(q) : Infinity,
          email.includes(q) ? email.indexOf(q) : Infinity
        );
        return { s, at };
      })
      .filter(({ s, at }) => at !== Infinity && s.email.toLowerCase() !== q);
    return ranked
      .sort(
        (a, b) => (a.at === 0 ? 0 : 1) - (b.at === 0 ? 0 : 1) || a.s.name.localeCompare(b.s.name)
      )
      .slice(0, 6)
      .map(({ s }) => s);
  });

  function pick(s: Suggestion) {
    inviteEmail = s.email;
    showSuggestions = false;
  }
  let resendingId = $state<string | null>(null);
  let resendSuccess = $state<string | null>(null);
  let resendError = $state<string | null>(null);

  function handleClose() {
    open = false;
    inviteEmail = '';
    showSuggestions = false;
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
      action="{actionBase}?/inviteMember"
      use:enhance={() => {
        return async ({ result }) => {
          // update() does two things: applies the result to the form prop (only
          // for same-page actions, so useless here) and invalidates load data.
          // Both halves are needed, so call them explicitly: applyAction keeps
          // the error/success messages, invalidateAll refreshes the invite list.
          await invalidateAll();
          await applyAction(result);
          if (result.type === 'success') {
            inviteEmail = '';
          }
        };
      }}
      id="invite-form"
    >
      <div class="form-group">
        <label for="invite-email" class="field-label">Email Address<span class="req">*</span></label
        >
        <div class="email-field">
          <input
            id="invite-email"
            type="email"
            name="email"
            bind:value={inviteEmail}
            placeholder="roommate@example.com"
            required
            autocomplete="off"
            onfocus={() => (showSuggestions = true)}
            oninput={() => (showSuggestions = true)}
            onblur={() => setTimeout(() => (showSuggestions = false), 150)}
          />
          {#if showSuggestions && matches.length > 0}
            <ul class="suggestions">
              {#each matches as s (s.id)}
                <li>
                  <button type="button" onclick={() => pick(s)}>
                    <span class="s-name">{s.name}</span>
                    <span class="s-email">{s.email}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        <p class="help-text">
          {#if suggestions.length > 0}
            Start typing, or pick someone from your other households. They'll receive an email with
            a link to join.
          {:else}
            Enter the email address of the person you want to invite. They'll receive an email with
            a link to join.
          {/if}
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
                    action="{actionBase}?/resendInvite"
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
                  <form
                    method="POST"
                    action="{actionBase}?/cancelInvite"
                    use:enhance={() => {
                      return async ({ result }) => {
                        await invalidateAll();
                        await applyAction(result);
                      };
                    }}
                  >
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
  .field-label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .req {
    color: var(--color-error);
    margin-left: 2px;
  }

  .email-field {
    position: relative;
  }

  .email-field input {
    width: 100%;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    min-height: 44px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
  }

  .email-field input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  /* Below the input so the on-screen keyboard cannot cover it */
  .suggestions {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    z-index: 30;
    margin: 0;
    padding: var(--space-xs);
    list-style: none;
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    max-height: 14rem;
    overflow-y: auto;
  }

  .suggestions button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    min-height: 48px;
    padding: var(--space-xs) var(--space-sm);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .suggestions button:hover,
  .suggestions button:focus-visible {
    background-color: var(--color-bg-secondary);
    outline: none;
  }

  .s-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  /* Never truncated: names are not unique, so the email is what tells two
     accounts for the same person apart. */
  .s-email {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    word-break: break-all;
  }

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
