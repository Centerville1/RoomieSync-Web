<script lang="ts">
  import type { PageData } from './$types';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';

  let { data }: { data: PageData } = $props();
</script>

<div class="home-container">
  <nav class="navbar">
    <div class="container">
      <div class="logo-container">
        <img src="/icon-nobg.png" alt="RoomieSync" class="logo-icon" />
        <h2 class="logo">RoomieSync</h2>
      </div>
      <div class="nav-links">
        {#if data.user}
          <span>Welcome, {data.user.name}!</span>
          <form method="POST" action="/logout">
            <Button variant="outline" type="submit">Sign Out</Button>
          </form>
        {:else}
          <a href="/signup">
            <Button variant="primary">Sign Up</Button>
          </a>
          <a href="/login">
            <Button variant="secondary">Sign In</Button>
          </a>
        {/if}
      </div>
    </div>
  </nav>

  <main class="container">
    {#if data.user}
      <section class="welcome-section">
        <h1>Your Households</h1>
        <p>Manage your shared expenses across all your households.</p>
        <Button variant="primary" size="lg">Create New Household</Button>
      </section>

      <!-- This will be populated with household list and invites -->
      <Card padding="lg">
        <p class="placeholder">Your households will appear here.</p>
      </Card>
    {:else}
      <section class="hero">
        <h1>Share Expenses with Your Roommates</h1>
        <p class="hero-subtitle">
          Track who owes what, split costs fairly, and keep your household finances organized.
        </p>
        <div class="cta-buttons">
          <a href="/signup">
            <Button variant="primary" size="lg">Get Started</Button>
          </a>
          <a href="/login">
            <Button variant="secondary" size="lg">Sign In</Button>
          </a>
        </div>
      </section>

      <section class="features">
        <Card padding="lg" hover>
          <h3>Track Expenses</h3>
          <p>Log shared costs and see who needs to pay who.</p>
        </Card>
        <Card padding="lg" hover>
          <h3>Multiple Households</h3>
          <p>Manage expenses across different living situations.</p>
        </Card>
        <Card padding="lg" hover>
          <h3>Split Costs</h3>
          <p>Easily divide expenses among selected roommates.</p>
        </Card>
      </section>
    {/if}
  </main>
</div>

<style>
  .home-container {
    min-height: 100vh;
  }

  .navbar {
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    padding: var(--space-md) 0;
  }

  .navbar .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo-container {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .logo-icon {
    height: 3.5rem;
  }

  .logo {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  .nav-links {
    display: flex;
    gap: var(--space-md);
    align-items: center;
  }

  main {
    padding: var(--space-2xl) var(--space-md);
  }

  .hero {
    text-align: center;
    padding: var(--space-2xl) 0;
    max-width: 800px;
    margin: 0 auto;
  }

  .hero h1 {
    font-size: 3rem;
    margin-bottom: var(--space-md);
    color: var(--color-text-primary);
  }

  .hero-subtitle {
    font-size: 1.25rem;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2xl);
  }

  .cta-buttons {
    display: flex;
    gap: var(--space-md);
    justify-content: center;
    flex-wrap: wrap;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-xl);
    margin-top: var(--space-2xl);
    padding: var(--space-2xl) 0;
  }

  .features :global(.card) {
    text-align: center;
  }

  .features h3 {
    margin: 0 0 var(--space-sm) 0;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .features p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .welcome-section {
    margin-bottom: var(--space-2xl);
  }

  .welcome-section h1 {
    margin-bottom: var(--space-sm);
  }

  .welcome-section p {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-lg);
  }

  .placeholder {
    color: var(--color-text-tertiary);
    text-align: center;
  }

  a {
    text-decoration: none;
  }

  @media (max-width: 768px) {
    .hero h1 {
      font-size: 2rem;
    }

    .hero-subtitle {
      font-size: 1rem;
    }
  }
</style>
