<script lang="ts">
  /**
   * A payment handle you can tap to copy.
   *
   * Sibling of CopyAmount: same reason for existing, different value. Copying
   * matters more here than the link does, because an in-app browser (Instagram,
   * Slack, any webview) will not hand off to a native app, so pasting a handle
   * is the path that always works.
   */
  let {
    handle,
    label = 'handle'
  }: {
    handle: string;
    label?: string;
  } = $props();

  // Copied as shown, sigil included: @billy-k is what Venmo's own search wants,
  // and a bare billy-k is just as findable, so the visible form is the honest
  // thing to put on the clipboard.
  const clipboardValue = $derived(handle);

  let copied = $state(false);
  let failed = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    failed = false;
    try {
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
  class="copy-handle"
  class:copied
  class:failed
  aria-label={copied ? `${label} ${handle} copied` : `Copy ${label} ${handle}`}
  title="Tap to copy {handle}"
  onclick={copy}
>
  <span class="value">{handle}</span>
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
      </svg>
    {/if}
  </span>
  <span class="sr-only" role="status" aria-live="polite">
    {#if copied}Copied {handle}{:else if failed}Could not copy{/if}
  </span>
</button>

<style>
  .copy-handle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    overflow-wrap: anywhere;
    text-align: left;
  }

  .copy-handle:hover {
    color: var(--color-text-primary);
  }

  .copy-handle:hover .icon {
    color: var(--color-text-secondary);
  }

  .copy-handle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-text-primary) 45%, transparent);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .copy-handle.copied .icon {
    color: var(--color-success);
  }

  .copy-handle.failed .icon {
    color: var(--color-error);
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
