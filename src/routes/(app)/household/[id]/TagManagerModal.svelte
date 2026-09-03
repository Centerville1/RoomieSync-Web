<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  type Tag = { id: string; name: string; color: string | null; sortOrder: number };

  // Only reachable by admins: tags are household-wide labels, so who defines
  // them is an admin decision. The server enforces this on every action.
  let {
    open = $bindable(false),
    tags = [],
    householdId
  }: {
    open: boolean;
    tags: Tag[];
    householdId: string;
  } = $props();

  const actionBase = $derived(`/household/${householdId}`);

  // A small fixed set, so a household picks a colour without a colour picker
  const PALETTE = [
    { value: '#6b7fff', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#a855f7', label: 'Purple' },
    { value: '#14b8a6', label: 'Teal' }
  ];

  let newName = $state('');
  let newColor = $state(PALETTE[0].value);
  let editingId = $state<string | null>(null);
  let editName = $state('');
  let editColor = $state(PALETTE[0].value);
  let confirmDeleteId = $state<string | null>(null);

  function startEdit(t: Tag) {
    editingId = t.id;
    editName = t.name;
    editColor = t.color ?? PALETTE[0].value;
    confirmDeleteId = null;
  }

  function reset() {
    editingId = null;
    editName = '';
    confirmDeleteId = null;
  }
</script>

<Modal bind:open title="Expense Tags" size="md">
  {#snippet children()}
    <p class="intro">
      Tags mark the expenses that matter: rent, utilities, anything the household cannot let slide.
      A tagged expense gets its own colour in the grid and raises a banner until you have paid your
      share.
    </p>

    <form
      method="POST"
      action="{actionBase}?/createTag"
      class="add-row"
      use:enhance={() => {
        return async ({ result }) => {
          await invalidateAll();
          await applyAction(result);
          if (result.type === 'success') newName = '';
        };
      }}
    >
      <input
        bind:value={newName}
        name="name"
        type="text"
        placeholder="Rent, Utilities…"
        autocomplete="off"
        autocapitalize="words"
        required
      />
      <select bind:value={newColor} name="color" aria-label="Tag colour">
        {#each PALETTE as c (c.value)}
          <option value={c.value}>{c.label}</option>
        {/each}
      </select>
      <Button type="submit" variant="primary" size="sm" disabled={newName.trim() === ''}>
        Add
      </Button>
    </form>

    {#if tags.length === 0}
      <p class="empty">No tags yet. Add one to start marking important expenses.</p>
    {:else}
      <ul class="tag-list">
        {#each tags as tag (tag.id)}
          <li class="tag-row">
            {#if editingId === tag.id}
              <form
                method="POST"
                action="{actionBase}?/updateTag"
                class="edit-row"
                use:enhance={() => {
                  return async ({ result }) => {
                    await invalidateAll();
                    await applyAction(result);
                    if (result.type === 'success') reset();
                  };
                }}
              >
                <input type="hidden" name="tagId" value={tag.id} />
                <input bind:value={editName} name="name" type="text" required autocomplete="off" />
                <select bind:value={editColor} name="color" aria-label="Tag colour">
                  {#each PALETTE as c (c.value)}
                    <option value={c.value}>{c.label}</option>
                  {/each}
                </select>
                <Button type="submit" variant="primary" size="sm">Save</Button>
                <button type="button" class="text-btn" onclick={reset}>Cancel</button>
              </form>
            {:else if confirmDeleteId === tag.id}
              <form
                method="POST"
                action="{actionBase}?/deleteTag"
                class="edit-row"
                use:enhance={() => {
                  return async ({ result }) => {
                    await invalidateAll();
                    await applyAction(result);
                    if (result.type === 'success') reset();
                  };
                }}
              >
                <input type="hidden" name="tagId" value={tag.id} />
                <span class="confirm-text">
                  Delete “{tag.name}”? Expenses keep their amounts but lose the tag.
                </span>
                <Button type="submit" variant="danger" size="sm">Delete</Button>
                <button type="button" class="text-btn" onclick={reset}>Cancel</button>
              </form>
            {:else}
              <span class="tag-chip" style="--tag-color: {tag.color ?? '#6b7fff'}">
                {tag.name}
              </span>
              <div class="tag-actions">
                <button type="button" class="text-btn" onclick={() => startEdit(tag)}>Edit</button>
                <button
                  type="button"
                  class="text-btn danger"
                  onclick={() => (confirmDeleteId = tag.id)}
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
    line-height: 1.5;
  }

  .add-row,
  .edit-row {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
    flex-wrap: wrap;
  }

  .add-row {
    margin-bottom: var(--space-md);
  }

  input[type='text'],
  select {
    min-width: 0;
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

  input[type='text'] {
    flex: 1;
  }

  input[type='text']:focus,
  select:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  .tag-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .tag-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: 48px;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    flex-wrap: wrap;
  }

  .tag-chip {
    padding: 2px var(--space-sm);
    border-radius: 999px;
    border: 1px solid var(--tag-color);
    background-color: color-mix(in srgb, var(--tag-color) 18%, transparent);
    color: var(--color-text-primary);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .confirm-text {
    flex: 1;
    min-width: 0;
    color: var(--color-text-primary);
    font-size: 0.88rem;
  }

  .tag-actions {
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
