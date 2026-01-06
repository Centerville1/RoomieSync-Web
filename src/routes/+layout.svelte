<script lang="ts">
  import '$lib/styles/global.css';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<svelte:head>
  <title>RoomieSync</title>
  <meta name="description" content="Shared household expense tracking made simple" />
</svelte:head>

{@render children()}
