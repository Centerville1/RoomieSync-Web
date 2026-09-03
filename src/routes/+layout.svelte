<script lang="ts">
  import '$lib/styles/global.css';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import type { LayoutData } from './$types';

  injectAnalytics();

  let { data, children }: { data: LayoutData; children: any } = $props();

  const currentYear = new Date().getFullYear();
</script>

<svelte:head>
  <title>RoomieSync</title>
  <meta name="description" content="Shared household expense tracking made simple" />
</svelte:head>

{@render children()}

<footer class="app-footer">
  <span>&copy; {currentYear} Matt Jones. All rights reserved.</span>
</footer>

<style>
  /*
   * Default: in-flow at the end of the page, so it scrolls into view instead of
   * floating over content. Anything narrower than a full laptop screen lacks the
   * side gutters a pinned label needs.
   */
  .app-footer {
    /* Bottom padding clears the fixed mobile tab bar, which would otherwise
       cover the footer entirely. --tabbar-height is 0 where there is no bar. */
    padding: var(--space-lg) var(--space-md) calc(var(--space-md) + var(--tabbar-height, 0px));
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  /* Wide screens: content caps at 1200px, so there is gutter room to pin it. */
  @media (min-width: 1200px) {
    .app-footer {
      position: fixed;
      bottom: 0;
      right: 0;
      padding: var(--space-sm) var(--space-md);
      text-align: right;
      pointer-events: none;
    }
  }
</style>
