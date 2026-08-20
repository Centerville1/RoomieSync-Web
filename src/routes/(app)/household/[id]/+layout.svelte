<script lang="ts">
  import type { LayoutData } from './$types';
  import Header from '$lib/components/Header.svelte';
  import { page } from '$app/state';

  let { data, children }: { data: LayoutData; children: any } = $props();

  const basePath = $derived(`/household/${data.household.id}`);
  const currentPath = $derived(page.url.pathname);

  // Trailing-slash tolerant, so /household/x and /household/x/ both match.
  const isExpensesTab = $derived(currentPath.replace(/\/$/, '') === basePath);
  const isShoppingTab = $derived(currentPath.startsWith(`${basePath}/shopping`));
</script>

<div class="household-container">
  <Header user={{ name: data.userName }} showBackButton />

  <!-- Household Header -->
  <header class="household-header">
    {#if data.household.bannerUrl}
      <div class="banner" style="background-image: url({data.household.bannerUrl})"></div>
    {/if}
    <div class="header-content container">
      {#if data.household.imageUrl}
        <img src={data.household.imageUrl} alt={data.household.name} class="household-avatar" />
      {/if}
      <div class="header-info">
        <h1>{data.household.name}</h1>
        <p>{data.members.length} {data.members.length === 1 ? 'member' : 'members'}</p>
      </div>
    </div>

    <!-- Tab bar -->
    <nav class="tabs container" aria-label="Household sections">
      <a href={basePath} class="tab" class:active={isExpensesTab} aria-current={isExpensesTab}>
        Expenses
      </a>
      <a
        href="{basePath}/shopping"
        class="tab"
        class:active={isShoppingTab}
        aria-current={isShoppingTab}
      >
        Shopping
      </a>
    </nav>
  </header>

  {@render children()}
</div>

<style>
  .household-container {
    min-height: 100vh;
    background-color: var(--color-bg-secondary);
  }

  .household-header {
    background-color: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    position: relative;
  }

  .banner {
    width: 100%;
    height: 12rem;
    background-size: cover;
    background-position: center;
    background-color: var(--color-bg-tertiary);
  }

  .header-content {
    padding: var(--space-xl) var(--space-xl) var(--space-md);
    display: flex;
    gap: var(--space-lg);
    align-items: center;
    flex-wrap: wrap;
  }

  .household-avatar {
    width: 6rem;
    height: 6rem;
    border-radius: var(--radius-lg);
    object-fit: cover;
    background-color: var(--color-bg-tertiary);
    border: 4px solid var(--color-bg-primary);
  }

  .header-info {
    flex: 1;
    min-width: 200px;
  }

  .header-info h1 {
    margin: 0 0 var(--space-xs) 0;
    font-size: 2rem;
    color: var(--color-text-primary);
  }

  .header-info p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  /* Tab bar */
  .tabs {
    display: flex;
    gap: var(--space-lg);
    padding: 0 var(--space-xl);
    /* Scrollable rather than wrapping if more tabs are added later */
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    position: relative;
    padding: var(--space-sm) var(--space-xs);
    /* Comfortable touch target on mobile */
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-decoration: none;
    white-space: nowrap;
    border-bottom: 3px solid transparent;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .tab:hover {
    color: var(--color-text-primary);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  @media (max-width: 767px) {
    .banner {
      height: 7rem;
    }

    .header-content {
      padding: var(--space-md) var(--space-md) var(--space-sm);
      gap: var(--space-md);
    }

    .household-avatar {
      width: 3.5rem;
      height: 3.5rem;
      border-width: 2px;
    }

    .header-info {
      min-width: 0;
    }

    .header-info h1 {
      font-size: 1.35rem;
    }

    .header-info p {
      font-size: 0.85rem;
    }

    .tabs {
      padding: 0 var(--space-md);
      gap: var(--space-md);
    }
  }
</style>
