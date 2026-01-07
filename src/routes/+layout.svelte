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
  .app-footer {
    position: fixed;
    bottom: 0;
    right: 0;
    padding: var(--space-sm) var(--space-md);
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    pointer-events: none;
  }
</style>
