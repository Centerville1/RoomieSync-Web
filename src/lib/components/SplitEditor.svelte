<script lang="ts">
  import { evaluateExpression, formatAmount } from '$lib/expression';
  import { calculateSplits } from '$lib/splits';

  type Member = { id: string; name: string; displayName: string | null };

  let {
    members = [],
    selectedMembers = $bindable<string[]>([]),
    /** Per-person overrides, keyed by user id. Absent means "take an even share". */
    overrides = $bindable<Record<string, number>>({}),
    total = 0,
    /** Always included and paid up front; also absorbs remainder pennies. */
    payerId,
    payerLabel = 'You',
    initializeAll = true
  }: {
    members: Member[];
    selectedMembers?: string[];
    overrides?: Record<string, number>;
    total?: number;
    payerId: string;
    payerLabel?: string;
    initializeAll?: boolean;
  } = $props();

  let hasInitialized = $state(false);
  $effect(() => {
    if (initializeAll && members.length > 0 && !hasInitialized) {
      selectedMembers = members.map((m) => m.id);
      hasInitialized = true;
    }
  });

  // Everyone the expense is divided between: the payer plus whoever is ticked
  const participants = $derived([
    { id: payerId, label: payerLabel },
    ...members
      .filter((m) => selectedMembers.includes(m.id))
      .map((m) => ({ id: m.id, label: m.displayName || m.name }))
  ]);

  // Live preview. Overridden shares are honoured; the rest divide what is left.
  const shares = $derived.by(() => {
    const result = calculateSplits(
      total,
      participants.map((p) => ({
        userId: p.id,
        override: overrides[p.id]
      })),
      payerId
    );
    return new Map(result.map((r) => [r.userId, r.amount]));
  });

  const overriddenTotal = $derived(
    participants.reduce((sum, p) => sum + (overrides[p.id] ?? 0), 0)
  );
  // Overrides that exceed the expense leave nothing for everyone else
  const overCommitted = $derived(overriddenTotal > total + 0.005);
  const allOverridden = $derived(
    participants.length > 0 && participants.every((p) => overrides[p.id] !== undefined)
  );
  const overriddenMismatch = $derived(allOverridden && Math.abs(overriddenTotal - total) > 0.005);

  // Which row is being edited, and the text in its field
  let editingId = $state<string | null>(null);
  let draft = $state('');

  function startOverride(id: string) {
    editingId = id;
    draft = formatAmount(shares.get(id) ?? 0);
  }

  function commitOverride(id: string) {
    const value = evaluateExpression(draft);
    if (value !== null) {
      overrides = { ...overrides, [id]: value };
    }
    editingId = null;
    draft = '';
  }

  function clearOverride(id: string) {
    const next = { ...overrides };
    delete next[id];
    overrides = next;
    if (editingId === id) {
      editingId = null;
      draft = '';
    }
  }

  function toggleMember(id: string) {
    if (selectedMembers.includes(id)) {
      selectedMembers = selectedMembers.filter((m) => m !== id);
      // Dropping someone should not leave their override behind
      clearOverride(id);
    } else {
      selectedMembers = [...selectedMembers, id];
    }
  }

  const allSelected = $derived(members.length > 0 && selectedMembers.length === members.length);

  function toggleAll() {
    if (allSelected) {
      for (const m of members) clearOverride(m.id);
      selectedMembers = [];
    } else {
      selectedMembers = members.map((m) => m.id);
    }
  }
</script>

<div class="split-editor">
  <div class="editor-head">
    <span class="editor-label">Split with</span>
    {#if members.length > 0}
      <label class="select-all">
        <input type="checkbox" checked={allSelected} onchange={toggleAll} />
        <span>Everyone else</span>
      </label>
    {/if}
  </div>

  <ul class="rows">
    <!-- The payer is always part of the split and cannot be removed -->
    <li class="row payer">
      <span class="who">
        <span class="name">{payerLabel}</span>
        <span class="tag">paid</span>
      </span>
      {@render shareCell({ id: payerId })}
    </li>

    {#each members as member (member.id)}
      {@const isIncluded = selectedMembers.includes(member.id)}
      <li class="row" class:excluded={!isIncluded}>
        <span class="who">
          <input
            type="checkbox"
            checked={isIncluded}
            onchange={() => toggleMember(member.id)}
            aria-label="Split with {member.displayName || member.name}"
          />
          <span class="name">{member.displayName || member.name}</span>
        </span>
        {#if isIncluded}
          {@render shareCell({ id: member.id })}
        {:else}
          <span class="not-included">not included</span>
        {/if}
      </li>
    {/each}
  </ul>

  {#if overCommitted}
    <p class="warn">
      The set amounts add up to more than the expense, so everyone else would owe nothing.
    </p>
  {:else if overriddenMismatch}
    <p class="warn">
      Every share is set manually but they add up to {formatAmount(overriddenTotal)}, not
      {formatAmount(total)}.
    </p>
  {/if}

  <!-- What actually gets posted: one amount per participant -->
  {#each participants as p (p.id)}
    <input type="hidden" name="splitUserIds" value={p.id} />
    <input type="hidden" name="splitAmounts" value={shares.get(p.id) ?? 0} />
  {/each}
</div>

{#snippet shareCell({ id }: { id: string })}
  {@const isOverridden = overrides[id] !== undefined}
  <span class="share">
    {#if editingId === id}
      <input
        class="override-input"
        bind:value={draft}
        type="text"
        inputmode="decimal"
        autocomplete="off"
        aria-label="Amount for this person"
        onblur={() => commitOverride(id)}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitOverride(id);
          }
          if (e.key === 'Escape') {
            editingId = null;
            draft = '';
          }
        }}
      />
    {:else}
      <button
        type="button"
        class="amount"
        class:overridden={isOverridden}
        onclick={() => startOverride(id)}
        title="Tap to set this amount"
      >
        ${formatAmount(shares.get(id) ?? 0)}
      </button>
      {#if isOverridden}
        <button
          type="button"
          class="clear"
          onclick={() => clearOverride(id)}
          title="Back to an even share"
          aria-label="Remove the set amount"
        >
          ×
        </button>
      {/if}
    {/if}
  </span>
{/snippet}

<style>
  .split-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .select-all {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .select-all input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .editor-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: 44px;
    padding: 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
  }

  .row.excluded {
    opacity: 0.55;
  }

  .row.payer {
    background-color: var(--color-bg-secondary);
  }

  .who {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .who input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .name {
    font-size: 0.92rem;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag {
    flex-shrink: 0;
    padding: 1px 0.4rem;
    border-radius: 999px;
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .share {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .amount {
    min-height: 32px;
    padding: 0 var(--space-sm);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.92rem;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .amount:hover {
    border-color: var(--color-primary);
    color: var(--color-text-primary);
  }

  /* Solid border and full contrast: this one was set by hand */
  .amount.overridden {
    border-style: solid;
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 700;
  }

  .clear {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }

  .clear:hover {
    color: var(--color-error);
  }

  .override-input {
    width: 5.5rem;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    min-height: 32px;
    padding: 0 var(--space-xs);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .override-input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
  }

  .not-included {
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    font-size: 0.8rem;
  }

  .warn {
    margin: 0;
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--color-warning) 14%, transparent);
    color: var(--color-text-primary);
    font-size: 0.82rem;
    line-height: 1.4;
  }
</style>
