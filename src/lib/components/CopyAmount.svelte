<script lang="ts">
  /**
   * An amount you can tap to copy, for pasting into a payment app.
   *
   * The whole amount is the button rather than a small icon beside it: this is
   * used on a phone, mid-task, with the payment app one switch away.
   */
  let {
    amount,
    label = 'amount',
    /** Rendered instead of the plain formatted amount, e.g. a struck-out original. */
    display = null,
    size = 'md' as 'sm' | 'md'
  }: {
    amount: number;
    label?: string;
    display?: string | null;
    size?: 'sm' | 'md';
  } = $props();

  const formatted = $derived(
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  );

  /**
   * Digits only, no currency symbol or thousands separator: Venmo, Cash App and
   * Zelle amount fields reject or mangle "$1,247.44", and the point of this is
   * that it pastes without editing.
   */
  const clipboardValue = $derived(amount.toFixed(2));

  let copied = $state(false);
  let failed = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    failed = false;
    try {
      // Only available over HTTPS or localhost, and can be refused outright,
      // so the fallback below is a real path rather than a formality.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardValue);
      } else {
        legacyCopy();
      }
      copied = true;
    } catch {
      try {
        legacyCopy();
        copied = true;
      } catch {
        // Say so rather than showing a tick for something that did not happen
        failed = true;
      }
    }

    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
      failed = false;
    }, 1800);
  }

  function legacyCopy() {
    const field = document.createElement('textarea');
    field.value = clipboardValue;
    // Off-screen rather than hidden: a display:none field cannot be selected
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    if (!ok) throw new Error('copy rejected');
  }

  $effect(() => () => clearTimeout(resetTimer));
</script>

<button
  type="button"
  class="copy-amount"
  class:sm={size === 'sm'}
  class:copied
  class:failed
  aria-label={copied
    ? `${label} ${formatted} copied`
    : `Copy ${label} ${formatted} to the clipboard`}
  title="Tap to copy {clipboardValue}"
  onclick={copy}
>
  <span class="value">{display ?? formatted}</span>
  <span class="icon" aria-hidden="true">
    {#if copied}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    {:else if failed}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    {:else}
      <!-- Two offset sheets: the conventional copy glyph, legible at 14px -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
      </svg>
    {/if}
  </span>
  <!-- Announced to a screen reader; sighted users get the tick -->
  <span class="sr-only" role="status" aria-live="polite">
    {#if copied}Copied {formatted}{:else if failed}Could not copy{/if}
  </span>
</button>

<style>
  /* No box: a bordered, tinted control fought the red amount inside it. The
     amount is left looking like the amount, and the icon carries the
     affordance. */
  .copy-amount {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    /* Comfortably tappable: this is used on a phone mid-payment */
    min-height: 40px;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-error);
    font-family: inherit;
    /* Matches the weight the amount had before it became a button: this is
       the figure the whole modal is about. */
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .copy-amount.sm {
    min-height: 32px;
    font-size: 0.95rem;
  }

  .copy-amount:hover .icon {
    color: var(--color-text-secondary);
  }

  .copy-amount:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 45%, transparent);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }

  .copy-amount:active {
    transform: scale(0.98);
  }

  /* Only the icon changes on success, so the amount does not flash a
     different colour mid-payment. */
  .copy-amount.copied .icon {
    color: var(--color-success);
  }

  .copy-amount.failed .icon {
    color: var(--color-error);
  }

  /* Muted grey rather than the brand orange, which clashed with the red
     amount sitting next to it. */
  .icon {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .icon svg {
    width: 100%;
    height: 100%;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
