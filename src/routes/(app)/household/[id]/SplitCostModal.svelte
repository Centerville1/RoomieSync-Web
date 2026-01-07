<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import MemberSelect from '$lib/components/MemberSelect.svelte';
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

  function handleClose() {
    open = false;
    isOptional = false;
    selectedMembers = [];
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

      {#if members.length > 0}
        <MemberSelect {members} bind:selectedMembers />
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
    </form>
  {/snippet}

  {#snippet footer()}
    <Button type="button" variant="ghost" on:click={handleClose}>Cancel</Button>
    <Button type="submit" variant="success" form="expense-form">Create Expense</Button>
  {/snippet}
</Modal>

<style>
  .form-group {
    margin-bottom: var(--space-lg);
  }

  .solo-notice {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: var(--space-md) 0;
  }
</style>
