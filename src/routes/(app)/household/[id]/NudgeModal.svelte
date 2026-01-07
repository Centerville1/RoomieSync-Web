<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { enhance } from '$app/forms';

  let {
    open = $bindable(false),
    recipientId = '',
    recipientName = '',
    amountOwed = 0,
    onNudgeSent
  }: {
    open: boolean;
    recipientId: string;
    recipientName: string;
    amountOwed: number;
    onNudgeSent?: () => void;
  } = $props();

  let customMessage = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function handleClose() {
    open = false;
    customMessage = '';
    errorMessage = '';
  }
</script>

<Modal bind:open title="Send Payment Reminder" size="sm">
  {#snippet children()}
    <form
      method="POST"
      action="?/sendNudge"
      use:enhance={() => {
        isSubmitting = true;
        errorMessage = '';
        return async ({ update, result }) => {
          isSubmitting = false;
          if (result.type === 'success') {
            handleClose();
            onNudgeSent?.();
          } else if (result.type === 'failure') {
            errorMessage = (result.data?.error as string) || 'Failed to send reminder';
          }
          await update({ reset: false });
        };
      }}
      id="nudge-form"
    >
      <input type="hidden" name="toUserId" value={recipientId} />
      <input type="hidden" name="amountOwed" value={amountOwed} />

      <div class="nudge-content">
        <p class="nudge-intro">
          Send a payment reminder to <strong>{recipientName}</strong>
        </p>

        <div class="amount-display">
          <span class="amount-label">Amount Owed</span>
          <span class="amount-value">{formatCurrency(amountOwed)}</span>
        </div>

        <div class="textarea-group">
          <label for="customMessage" class="label">Add a message (optional)</label>
          <textarea
            id="customMessage"
            name="customMessage"
            placeholder="Hey, just a friendly reminder about those shared expenses..."
            bind:value={customMessage}
            rows={3}
            class="textarea"
          ></textarea>
        </div>

        {#if errorMessage}
          <p class="error-message">{errorMessage}</p>
        {/if}

        <p class="nudge-note">
          An email will be sent to {recipientName} with a link to view and pay their expenses.
        </p>
      </div>
    </form>
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Cancel</Button>
    <Button type="submit" variant="primary" form="nudge-form" disabled={isSubmitting}>
      {isSubmitting ? 'Sending...' : 'Send Reminder'}
    </Button>
  {/snippet}
</Modal>

<style>
  .nudge-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .nudge-intro {
    margin: 0;
    color: var(--color-text-primary);
  }

  .nudge-intro strong {
    color: var(--color-primary);
  }

  .amount-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .amount-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .amount-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-success);
  }

  .textarea-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .textarea {
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: var(--font-sans);
    color: var(--color-text-primary);
    background-color: var(--color-bg-primary);
    transition: all 0.2s;
    resize: vertical;
    min-height: 80px;
  }

  .textarea:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(107, 127, 255, 0.1);
  }

  .error-message {
    margin: 0;
    padding: var(--space-sm) var(--space-md);
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-error);
    font-size: 0.875rem;
  }

  .nudge-note {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-tertiary);
    text-align: center;
  }
</style>
