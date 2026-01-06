<script lang="ts">
  import type { PageData } from './$types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';

  let { data }: { data: PageData } = $props();
</script>

<div class="household-container">
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
      <div class="header-actions">
        <Button variant="primary" size="lg">Split the Cost</Button>
      </div>
    </div>
  </header>

  <main class="container">
    <section class="members-section">
      <h2>Members</h2>
      <div class="members-grid">
        {#each data.members as member}
          <Card padding="md">
            <div class="member-card">
              <div class="member-info">
                <h3>{member.name}</h3>
                <p class="member-email">{member.email}</p>
              </div>
              {#if member.role === 'admin'}
                <Badge variant="primary">Admin</Badge>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    </section>

    <section class="expenses-section">
      <h2>Expenses</h2>
      <Card padding="lg">
        <p class="placeholder">No expenses yet. Click "Split the Cost" to create one.</p>
      </Card>
    </section>
  </main>
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
    padding: var(--space-xl);
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

  .header-actions {
    display: flex;
    gap: var(--space-md);
  }

  main {
    padding: var(--space-2xl) var(--space-md);
  }

  .members-section,
  .expenses-section {
    margin-bottom: var(--space-2xl);
  }

  .members-section h2,
  .expenses-section h2 {
    margin: 0 0 var(--space-lg) 0;
    font-size: 1.5rem;
    color: var(--color-text-primary);
  }

  .members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--space-md);
  }

  .member-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }

  .member-info h3 {
    margin: 0 0 var(--space-xs) 0;
    font-size: 1rem;
    color: var(--color-text-primary);
  }

  .member-email {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .placeholder {
    color: var(--color-text-tertiary);
    text-align: center;
    margin: 0;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions :global(button) {
      width: 100%;
    }

    .header-info h1 {
      font-size: 1.5rem;
    }
  }
</style>
