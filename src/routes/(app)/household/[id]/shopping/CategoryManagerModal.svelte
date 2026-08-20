<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { enhance } from '$app/forms';

  type Category = { id: string; name: string; color: string | null; sortOrder: number };

  let {
    open = $bindable(false),
    categories = []
  }: {
    open: boolean;
    categories: Category[];
  } = $props();

  let newName = $state('');
  let editingId = $state<string | null>(null);
  let editName = $state('');
  let confirmDeleteId = $state<string | null>(null);

  function startEdit(c: Category) {
    editingId = c.id;
    editName = c.name;
    confirmDeleteId = null;
  }

  function reset() {
    editingId = null;
    editName = '';
    confirmDeleteId = null;
  }
</script>

<Modal bind:open title="Shopping Categories" size="md">
  {#snippet children()}
    <p class="intro">
      Categories are shared with the whole household. Deleting one keeps its items and moves them to
      Uncategorised.
    </p>

    <form
      method="POST"
      action="?/createCategory"
      class="add-row"
      use:enhance={() => {
        return async ({ result, update }) => {
          await update({ reset: false });
          if (result.type === 'success') newName = '';
        };
      }}
    >
      <input
        bind:value={newName}
        name="name"
        type="text"
        placeholder="New category…"
        autocomplete="off"
        autocapitalize="words"
        required
      />
      <Button type="submit" variant="primary" size="sm" disabled={newName.trim() === ''}>
        Add
      </Button>
    </form>

    {#if categories.length === 0}
      <p class="empty">No categories yet. Add one above to start grouping items.</p>
    {:else}
      <ul class="cat-list">
        {#each categories as c (c.id)}
          <li class="cat">
            {#if editingId === c.id}
              <form
                method="POST"
                action="?/updateCategory"
                class="edit-row"
                use:enhance={() => {
                  return async ({ update }) => {
                    await update({ reset: false });
                    reset();
                  };
                }}
              >
                <input type="hidden" name="categoryId" value={c.id} />
                <input bind:value={editName} name="name" type="text" required autocomplete="off" />
                <Button type="submit" variant="primary" size="sm">Save</Button>
                <button type="button" class="text-btn" onclick={reset}>Cancel</button>
              </form>
            {:else if confirmDeleteId === c.id}
              <form
                method="POST"
                action="?/deleteCategory"
                class="edit-row"
                use:enhance={() => {
                  return async ({ update }) => {
                    await update({ reset: false });
                    reset();
                  };
                }}
              >
                <input type="hidden" name="categoryId" value={c.id} />
                <span class="confirm-text">Delete “{c.name}”?</span>
                <Button type="submit" variant="danger" size="sm">Delete</Button>
                <button type="button" class="text-btn" onclick={reset}>Cancel</button>
              </form>
            {:else}
              <span class="cat-name">{c.name}</span>
              <div class="cat-actions">
                <button type="button" class="text-btn" onclick={() => startEdit(c)}>Rename</button>
                <button
                  type="button"
                  class="text-btn danger"
                  onclick={() => (confirmDeleteId = c.id)}
                >
                  Delete
                </button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  {#snippet footer()}
    <Button variant="secondary" on:click={() => (open = false)}>Done</Button>
  {/snippet}
</Modal>

<style>
  .intro {
    margin: 0 0 var(--space-md);
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .add-row,
  .edit-row {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
  }

  .add-row {
    margin-bottom: var(--space-md);
  }

  input[type='text'] {
    flex: 1;
    min-width: 0;
    /* 16px minimum stops iOS Safari zooming on focus */
    font-size: 16px;
    min-height: 44px;
    padding: 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
  }

  input[type='text']:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  .cat-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .cat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: 48px;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
  }

  .cat-name {
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .confirm-text {
    flex: 1;
    min-width: 0;
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }

  .cat-actions {
    display: flex;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .text-btn {
    min-height: 40px;
    padding: 0 var(--space-sm);
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .text-btn:hover {
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .text-btn.danger:hover {
    color: var(--color-error);
  }

  .empty {
    margin: 0;
    padding: var(--space-lg);
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
  }
</style>
