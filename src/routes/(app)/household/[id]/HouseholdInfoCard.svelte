<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import { enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let {
    info = null,
    householdId,
    isAdmin = false
  }: {
    /** Plain text set by an admin. Null or empty hides the card for members. */
    info?: string | null;
    householdId: string;
    isAdmin?: boolean;
  } = $props();

  // Actions live on the expenses page; this renders there too, but address them
  // absolutely so the card can move without the form silently breaking.
  const actionBase = $derived(`/household/${householdId}`);

  const hasInfo = $derived((info ?? '').trim().length > 0);

  let expanded = $state(false);
  let editing = $state(false);
  let draft = $state('');
  let submitting = $state(false);

  // The rendered block is clamped by max-height, so only offer "Show more" when
  // the content is actually taller than the clamp.
  let bodyEl = $state<HTMLElement | null>(null);
  let overflows = $state(false);

  $effect(() => {
    // Re-measure when the text or the expanded state changes
    const _ = [info, expanded, editing];
    if (!bodyEl || expanded) return;
    overflows = bodyEl.scrollHeight > bodyEl.clientHeight + 2;
  });

  function startEdit() {
    draft = info ?? '';
    editing = true;
  }

  function cancelEdit() {
    editing = false;
    draft = '';
  }
</script>

{#if hasInfo || isAdmin}
  <Card padding="none">
    <div class="info-card" class:expanded>
      <div class="info-head">
        <h3 class="info-title">Household Info</h3>
        {#if isAdmin && !editing}
          <button type="button" class="edit-btn" onclick={startEdit}>
            {hasInfo ? 'Edit' : 'Add'}
          </button>
        {/if}
      </div>

      {#if editing}
        <form
          method="POST"
          action="{actionBase}?/setHouseholdInfo"
          class="info-form"
          use:enhance={() => {
            submitting = true;
            return async ({ result }) => {
              await invalidateAll();
              await applyAction(result);
              submitting = false;
              if (result.type === 'success') cancelEdit();
            };
          }}
        >
          <textarea
            bind:value={draft}
            name="info"
            rows="8"
            maxlength="5000"
            placeholder={'Wifi: network / password\nBins go out Tuesday night\nLandlord: 555-0143'}
          ></textarea>
          <div class="form-actions">
            <span class="char-count">{draft.length}/5000</span>
            <button type="button" class="text-btn" onclick={cancelEdit} disabled={submitting}>
              Cancel
            </button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      {:else if hasInfo}
        <!-- pre-wrap keeps the admin's line breaks without interpreting markup -->
        <div class="info-body" bind:this={bodyEl}>{info}</div>
      {:else}
        <p class="info-empty">
          Add wifi details, bin days, house rules or anything else the household should have to
          hand.
        </p>
      {/if}
    </div>

    {#if hasInfo && !editing && (overflows || expanded)}
      <button
        type="button"
        class="expand-bar"
        onclick={() => (expanded = !expanded)}
        aria-expanded={expanded}
      >
        <span class="caret" class:open={expanded}>▸</span>
        {expanded ? 'Show less' : 'Show more'}
      </button>
    {/if}
  </Card>
{/if}

<style>
  .info-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-lg) var(--space-lg) var(--space-md);
  }

  .info-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .info-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .edit-btn {
    flex-shrink: 0;
    min-height: 32px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .edit-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* Clamped until expanded. The height is set by the parent so the card can
     match the balance card side by side. */
  .info-body {
    max-height: var(--info-max-height, 8.5rem);
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--color-text-secondary);
    font-size: 0.92rem;
    line-height: 1.55;
  }

  .expanded .info-body {
    max-height: none;
    overflow: visible;
  }

  .info-empty {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .info-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  textarea {
    width: 100%;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    padding: var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
  }

  textarea:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-sm);
  }

  .char-count {
    margin-right: auto;
    color: var(--color-text-tertiary);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }

  .text-btn {
    min-height: 36px;
    padding: 0 var(--space-sm);
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
  }

  .text-btn:hover:not(:disabled) {
    color: var(--color-text-primary);
  }

  /* Matches the balance card's footer bar, so the two read as a pair */
  .expand-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 38px;
    padding: 0 var(--space-lg);
    border: none;
    border-top: 1px solid var(--color-border);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .expand-bar:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .caret {
    display: inline-block;
    font-size: 0.8rem;
    transition: transform 0.15s ease;
  }

  .caret.open {
    transform: rotate(90deg);
  }

  @media (max-width: 767px) {
    .info-card {
      padding: var(--space-md) var(--space-md) var(--space-sm);
    }

    /* Smaller on mobile, where it sits below the balance card */
    .info-body {
      max-height: var(--info-max-height-mobile, 5.5rem);
      font-size: 0.88rem;
    }
  }
</style>
