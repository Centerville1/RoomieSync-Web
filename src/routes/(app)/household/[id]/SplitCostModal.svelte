<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import SplitEditor from '$lib/components/SplitEditor.svelte';
  import AmountInput from '$lib/components/AmountInput.svelte';
  import { enhance } from '$app/forms';

  let {
    open = $bindable(false),
    members = [],
    currentUserId,
    form
  }: {
    open: boolean;
    members: Array<{ id: string; name: string; displayName: string | null }>;
    currentUserId: string;
    form?: { error?: string } | null;
  } = $props();

  let selectedMembers = $state<string[]>([]);
  let overrides = $state<Record<string, number>>({});
  let amount = $state(0);
  let isOptional = $state(false);
  // Set false by the split editor while the pinned amounts cannot reconcile
  let splitValid = $state(true);

  const canSubmit = $derived(amount > 0 && splitValid);

  function handleClose() {
    open = false;
    isOptional = false;
    selectedMembers = [];
    overrides = {};
    amount = 0;
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
        <AmountInput
          bind:value={amount}
          name="amount"
          id="expense-amount"
          label="Amount"
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

      {#if members.length > 0}
        <SplitEditor
          {members}
          bind:selectedMembers
          bind:overrides
          bind:valid={splitValid}
          total={amount}
          payerId={currentUserId}
        />
      {:else}
        <p class="solo-notice">
          You're the only member. This expense will be tracked for your records.
        </p>
      {/if}

      <div class="form-group">
        <Checkbox
          name="isOptional"
          bind:checked={isOptional}
          label="Optional expense (people can choose to pay)"
        />
      </div>
      {#if form?.error}
        <p class="form-error">{form.error}</p>
      {/if}
    </form>
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Cancel</Button>
    <Button type="submit" variant="success" form="expense-form" disabled={!canSubmit}>
      Create Expense
    </Button>
  {/snippet}
</Modal>

<style>
  .form-error {
    margin: var(--space-sm) 0 0;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
    color: var(--color-error);
    font-size: 0.88rem;
  }

  .form-group {
    margin-bottom: var(--space-lg);
  }

  .solo-notice {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: var(--space-md) 0;
  }
</style>
