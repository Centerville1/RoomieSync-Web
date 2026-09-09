<script lang="ts">
  import type { PageData } from './$types';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Input from '$lib/components/Input.svelte';
  import Header from '$lib/components/Header.svelte';

  let { data }: { data: PageData } = $props();

  let showCreateModal = $state(false);
  let householdName = $state('');
  let isSubmitting = $state(false);
  let showArchived = $state(false);

  function handleCreateClick() {
    showCreateModal = true;
  }

  const siteUrl = 'https://www.roomiesync.net';
  const pageTitle = 'RoomieSync - Shared Household Expense Tracking';
  const pageDescription =
    'Track shared expenses with your roommates. Split costs fairly, see who owes what, and keep your household finances organized. Free and easy to use.';
  const pageImage = `${siteUrl}/icon.png`;
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={pageDescription} />
  <link rel="canonical" href={siteUrl} />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content={siteUrl} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:image" content={pageImage} />
  <meta property="og:site_name" content="RoomieSync" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:url" content={siteUrl} />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={pageDescription} />
  <meta name="twitter:image" content={pageImage} />

  <!-- Additional SEO -->
  <meta name="robots" content="index, follow" />
  <meta
    name="keywords"
    content="expense tracking, roommate expenses, split bills, household expenses, shared costs, roommate app, bill splitting"
  />
  <meta name="author" content="RoomieSync" />

  <!-- Structured Data -->
  {@html `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "RoomieSync",
      "description": "${pageDescription}",
      "url": "${siteUrl}",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "featureList": [
        "Track shared household expenses",
        "Split costs among roommates",
        "Multiple household support",
        "Payment tracking"
      ]
    }
  </script>`}
</svelte:head>

<div class="home-container">
  <Header user={data.user} />

  <main class="container">
    {#if data.user}
      <!-- Pending Invites Section -->
      {#if data.pendingInvites && data.pendingInvites.length > 0}
        <section class="invites-section">
          <h2>Pending Invites</h2>
          <div class="invites-list">
            {#each data.pendingInvites as invite}
              <Card padding="lg">
                <div class="invite-card">
                  <div class="invite-info">
                    {#if invite.householdImageUrl}
                      <img
                        src={invite.householdImageUrl}
                        alt={invite.householdName}
                        class="invite-image"
                      />
                    {/if}
                    <div>
                      <h3>{invite.householdName}</h3>
                      <p class="invite-text">You've been invited to join this household</p>
                    </div>
                  </div>
                  <div class="invite-actions">
                    <form method="POST" action="?/acceptInvite">
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <Button type="submit" variant="primary">Accept</Button>
                    </form>
                    <form method="POST" action="?/declineInvite">
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <Button type="submit" variant="outline">Decline</Button>
                    </form>
                  </div>
                </div>
              </Card>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Getting paid back only works if people fill this in, and nobody goes
           looking in settings for a feature they have not seen, so it asks
           here. Two states: none saved at all, or one saved and no fallback.
           Silent once there are two, since the nagging has done its job. -->
      {#if data.households && data.households.length > 0 && data.paymentMethodCount < 2}
        <section class="pay-prompt" class:gentle={data.paymentMethodCount === 1}>
          <div class="pay-prompt-text">
            {#if data.paymentMethodCount === 0}
              <strong>Add how people pay you back</strong>
              <span>
                Your household sees your Venmo, Cash App or Zelle when they settle up, so nobody has
                to ask.
              </span>
            {:else}
              <strong>Add a backup way to be paid</strong>
              <span>
                You have one. A second means someone who cannot use it still has a way to pay you.
              </span>
            {/if}
          </div>
          <a class="pay-prompt-btn" href="/settings#getting-paid">
            {data.paymentMethodCount === 0 ? 'Add a method' : 'Add a backup'}
          </a>
        </section>
      {/if}

      <section class="welcome-section">
        <h1>Your Households</h1>
        <p>Manage your shared expenses across all your households.</p>
        <Button variant="primary" size="lg" on:click={handleCreateClick}
          >Create New Household</Button
        >
      </section>

      <!-- Household list -->
      {#if data.households && data.households.length > 0}
        <div class="households-grid">
          {#each data.households as household}
            <a href="/household/{household.id}" class="household-card-link">
              <Card padding="lg" hover>
                <div class="household-card">
                  {#if household.imageUrl}
                    <img src={household.imageUrl} alt={household.name} class="household-image" />
                  {/if}
                  <div class="household-info">
                    <h3>{household.name}</h3>
                    <p class="household-role">
                      {household.role === 'admin' ? 'Admin' : 'Member'}
                    </p>
                  </div>
                </div>
              </Card>
            </a>
          {/each}
        </div>
      {:else}
        <Card padding="lg">
          <p class="placeholder">Your households will appear here.</p>
        </Card>
      {/if}

      <!-- Archived households: out of the main list but still reachable, so
           members keep access to past expenses. -->
      {#if data.archivedHouseholds && data.archivedHouseholds.length > 0}
        <section class="archived-section">
          <button
            type="button"
            class="archived-toggle"
            onclick={() => (showArchived = !showArchived)}
            aria-expanded={showArchived}
          >
            <span class="caret" class:open={showArchived}>▸</span>
            Archived
            <span class="archived-count">{data.archivedHouseholds.length}</span>
          </button>

          {#if showArchived}
            <div class="archived-list">
              {#each data.archivedHouseholds as household}
                <a href="/household/{household.id}" class="archived-card-link">
                  <div class="archived-card">
                    {#if household.imageUrl}
                      <img src={household.imageUrl} alt={household.name} class="archived-image" />
                    {/if}
                    <div class="archived-info">
                      <h3>{household.name}</h3>
                      <p class="archived-meta">
                        {household.role === 'admin' ? 'Admin' : 'Member'} · Archived
                      </p>
                    </div>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
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

<!-- Create Household Modal -->
<Modal bind:open={showCreateModal} title="Create New Household" size="md">
  <form method="POST" action="?/createHousehold">
    <Input
      label="Household Name"
      type="text"
      name="name"
      bind:value={householdName}
      placeholder="e.g., Main Street Apartment"
      required
    />

    <div class="form-actions">
      <Button type="button" variant="outline" on:click={() => (showCreateModal = false)}>
        Cancel
      </Button>
      <Button type="submit" variant="primary" disabled={isSubmitting || !householdName.trim()}>
        {isSubmitting ? 'Creating...' : 'Create Household'}
      </Button>
    </div>
  </form>
</Modal>

<style>
  /* Sits above the household list: prominent when there is nothing saved,
     quieter once there is one and this is only a suggestion. */
  .pay-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
    padding: var(--space-md);
    border: 1px solid color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
    border-radius: var(--radius-lg);
    background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
    flex-wrap: wrap;
  }

  .pay-prompt.gentle {
    border-color: var(--color-border);
    background-color: var(--color-bg-secondary);
  }

  .pay-prompt-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .pay-prompt-text strong {
    color: var(--color-text-primary);
    font-size: 0.95rem;
  }

  .pay-prompt-text span {
    color: var(--color-text-secondary);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .pay-prompt-btn {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 var(--space-md);
    border-radius: var(--radius-md);
    background-color: var(--color-primary);
    color: white;
    font-size: 0.88rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .pay-prompt-btn:hover {
    filter: brightness(1.05);
  }

  .pay-prompt.gentle .pay-prompt-btn {
    background-color: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
  }

  @media (max-width: 767px) {
    .pay-prompt-btn {
      width: 100%;
      justify-content: center;
    }
  }

  .home-container {
    min-height: 100vh;
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

  .invites-section {
    margin-bottom: var(--space-2xl);
  }

  .invites-section h2 {
    margin-bottom: var(--space-lg);
    font-size: 1.5rem;
    color: var(--color-text-primary);
  }

  .invites-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .invite-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-lg);
    flex-wrap: wrap;
  }

  .invite-info {
    display: flex;
    gap: var(--space-md);
    align-items: center;
    flex: 1;
  }

  .invite-image {
    width: 3rem;
    height: 3rem;
    object-fit: cover;
    border-radius: var(--radius-md);
    background-color: var(--color-bg-tertiary);
  }

  .invite-info h3 {
    margin: 0 0 var(--space-xs) 0;
    font-size: 1.125rem;
    color: var(--color-text-primary);
  }

  .invite-text {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .invite-actions {
    display: flex;
    gap: var(--space-sm);
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

  .form-actions {
    display: flex;
    gap: var(--space-md);
    justify-content: flex-end;
    margin-top: var(--space-xl);
  }

  .households-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-lg);
  }

  .household-card-link {
    text-decoration: none;
    color: inherit;
  }

  /* Archived: visually quieter than the active grid so it reads as secondary,
     but still a real link into the household. */
  .archived-section {
    margin-top: var(--space-xl);
  }

  .archived-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 48px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }

  .archived-toggle:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-tertiary);
  }

  .caret {
    display: inline-block;
    font-size: 0.8rem;
    transition: transform 0.15s ease;
  }

  .caret.open {
    transform: rotate(90deg);
  }

  .archived-count {
    margin-left: auto;
    padding: 1px 0.5rem;
    border-radius: 999px;
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .archived-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .archived-card-link {
    text-decoration: none;
    color: inherit;
  }

  .archived-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    min-height: 64px;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    transition: border-color 0.15s ease;
  }

  .archived-card:hover {
    border-color: var(--color-text-tertiary);
  }

  .archived-image {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-sm);
    object-fit: cover;
    /* Muted so archived rows do not compete with the active grid */
    filter: grayscale(0.6);
    opacity: 0.8;
  }

  .archived-info h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text-secondary);
  }

  .archived-meta {
    margin: 0;
    font-size: 0.82rem;
    color: var(--color-text-tertiary);
  }

  .household-card {
    display: flex;
    gap: var(--space-md);
    align-items: center;
  }

  .household-image {
    width: 4rem;
    height: 4rem;
    object-fit: cover;
    border-radius: var(--radius-md);
    background-color: var(--color-bg-tertiary);
  }

  .household-info h3 {
    margin: 0 0 var(--space-xs) 0;
    font-size: 1.125rem;
    color: var(--color-text-primary);
  }

  .household-role {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
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
