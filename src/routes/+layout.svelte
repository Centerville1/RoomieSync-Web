<script lang="ts">
  import '$lib/styles/global.css';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import type { LayoutData } from './$types';

  injectAnalytics();

  let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<svelte:head>
  <title>RoomieSync</title>
  <meta name="description" content="Shared household expense tracking made simple" />
</svelte:head>

{@render children()}
