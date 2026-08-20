<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { enhance } from '$app/forms';

  type Item = { id: string; name: string; quantity: string | null };

  let {
    open = $bindable(false),
    items = [],
    onDone
  }: {
    open: boolean;
    items: Item[];
    /** Called after the items are marked purchased. `split` reflects which button was used. */
    onDone: (split: boolean) => void;
  } = $props();

  // Which button was pressed. Read in the enhance callback, since both submit
  // the same form.
  let splitAfter = $state(false);
  let submitting = $state(false);
  let formEl = $state<HTMLFormElement | null>(null);

  function submit(split: boolean) {
    splitAfter = split;
    formEl?.requestSubmit();
  }
</script>

<Modal bind:open title="Mark as purchased?" size="sm">
  {#snippet children()}
    <form
      bind:this={formEl}
      method="POST"
      action="?/setPurchased"
      id="confirm-purchase-form"
      use:enhance={() => {
        const split = splitAfter;
        submitting = true;
        return async ({ result, update }) => {
          submitting = false;
          await update({ reset: false });
          if (result.type === 'success') {
            open = false;
            onDone(split);
          }
        };
      }}
    >
      {#each items as item (item.id)}
        <input type="hidden" name="itemIds" value={item.id} />
      {/each}
      <input type="hidden" name="purchased" value="true" />

      <p class="intro">
        {items.length === 1
          ? 'This item will move off the list:'
          : `These ${items.length} items will move off the list:`}
      </p>

      <ul class="item-list">
        {#each items as item (item.id)}
          <li>
            <span class="item-name">{item.name}</span>
            {#if item.quantity && item.quantity !== '1'}
              <span class="item-qty">×{item.quantity}</span>
            {/if}
          </li>
        {/each}
      </ul>

      <p class="hint">
        If you paid for these, you can split the cost with the household in the next step.
      </p>
    </form>
  {/snippet}

  {#snippet footer()}
    <div class="actions">
      <Button variant="ghost" disabled={submitting} on:click={() => (open = false)}>Cancel</Button>
      <div class="confirm-pair">
        <Button variant="secondary" disabled={submitting} on:click={() => submit(false)}>
          Confirm
        </Button>
        <Button variant="success" disabled={submitting} on:click={() => submit(true)}>
          Confirm &amp; split the cost
        </Button>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .intro {
    margin: 0 0 var(--space-sm);
    color: var(--color-text-secondary);
    font-size: 0.92rem;
  }

  .item-list {
    margin: 0 0 var(--space-md);
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* Long selections stay scannable without pushing the buttons off screen */
    max-height: 12rem;
    overflow-y: auto;
  }

  .item-list li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-secondary);
  }

  .item-name {
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-qty {
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: 0.85rem;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    width: 100%;
  }

  .confirm-pair {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  @media (max-width: 560px) {
    .actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }

    .confirm-pair {
      flex-direction: column;
    }

    .actions :global(.btn) {
      width: 100%;
    }
  }
</style>
