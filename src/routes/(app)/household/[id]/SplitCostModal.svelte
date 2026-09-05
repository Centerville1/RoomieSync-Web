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
    tags = [],
    form
  }: {
    open: boolean;
    members: Array<{ id: string; name: string; displayName: string | null }>;
    currentUserId: string;
    /** The household's important-expense types; empty until one is created */
    tags?: Array<{ id: string; name: string; color: string | null }>;
    form?: { error?: string } | null;
  } = $props();

  let selectedMembers = $state<string[]>([]);
  let overrides = $state<Record<string, number>>({});
  let amount = $state(0);
  let isOptional = $state(false);
  let tagId = $state('');
  let dueDate = $state('');
  // Set false by the split editor while the pinned amounts cannot reconcile
  let splitValid = $state(true);
  // True while the amount text cannot be resolved: typing "12" then "+" leaves
  // the last good value in `amount`, so checking amount > 0 is not enough.
  let amountInvalid = $state(false);

  const canSubmit = $derived(amount > 0 && !amountInvalid && splitValid);

  function handleClose() {
    open = false;
    isOptional = false;
    tagId = '';
    dueDate = '';
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
          bind:invalid={amountInvalid}
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

      {#if tags.length > 0}
        <div class="form-group">
          <label for="expense-tag" class="tag-label">High Priority Type</label>
          <select bind:value={tagId} name="tagId" id="expense-tag">
            <option value="">Normal Expense</option>
            {#each tags as t (t.id)}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
          <p class="tag-help">
            Setting this expense as a high priority type shows everyone a banner and lets you set a
            due date.
          </p>
        </div>

        <!-- Only meaningful on a high priority expense, and optional even then -->
        {#if tagId !== ''}
          <div class="form-group">
            <label for="expense-due" class="tag-label">Due date (optional)</label>
            <input bind:value={dueDate} type="date" name="dueDate" id="expense-due" />
          </div>
        {/if}
      {/if}

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
  .tag-label {
    display: block;
    margin-bottom: var(--space-xs);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  select,
  input[type='date'] {
    width: 100%;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    min-height: 44px;
    padding: 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
  }

  select:focus,
  input[type='date']:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  .tag-help {
    margin: var(--space-xs) 0 0;
    color: var(--color-text-tertiary);
    font-size: 0.78rem;
    line-height: 1.4;
  }

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
