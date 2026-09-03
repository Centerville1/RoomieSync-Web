<script lang="ts">
  import type { LayoutData, ActionData } from './$types';
  import Header from '$lib/components/Header.svelte';
  import Button from '$lib/components/Button.svelte';
  import InviteMemberModal from './InviteMemberModal.svelte';
  import HouseholdSettingsModal from './HouseholdSettingsModal.svelte';
  import { page } from '$app/state';

  let { data, children, form }: { data: LayoutData; children: any; form: ActionData } = $props();

  let showInviteModal = $state(false);
  let showSettingsModal = $state(false);

  // Measured so the sticky header can offset the banner out of view exactly,
  // rather than hardcoding a height that changes with the breakpoint.
  let bannerHeight = $state(0);

  // Nobody else here yet and nothing pending: inviting is the only useful thing
  // an admin can do, so it earns a full CTA. After that it shrinks to a link
  // beside the member count.
  const isNewHousehold = $derived(
    data.members.length <= 1 && (data.pendingInvites?.length ?? 0) === 0
  );

  const pendingCount = $derived(data.pendingInvites?.length ?? 0);

  const basePath = $derived(`/household/${data.household.id}`);
  const currentPath = $derived(page.url.pathname);

  // Trailing-slash tolerant, so /household/x and /household/x/ both match.
  const isExpensesTab = $derived(currentPath.replace(/\/$/, '') === basePath);
  // Anchored so a future sibling like /shopping-history cannot match
  const isShoppingTab = $derived(
    currentPath === `${basePath}/shopping` || currentPath.startsWith(`${basePath}/shopping/`)
  );
</script>

<div class="household-container">
  <Header user={{ name: data.userName }} showBackButton />

  {#if data.household.archivedAt}
    <div class="archived-banner" role="status">
      <strong>This household is archived.</strong>
      <span>
        It has moved out of your main list on the home page. Everything still works.{data.userRole ===
        'admin'
          ? ' You can restore it in household settings.'
          : ''}
      </span>
    </div>
  {/if}

  <!-- Household Header -->
  <header class="household-header" style="--banner-height: {bannerHeight}px">
    {#if data.household.bannerUrl}
      <div
        class="banner"
        style="background-image: url({data.household.bannerUrl})"
        bind:clientHeight={bannerHeight}
      ></div>
    {/if}
    <div class="header-content container">
      {#if data.household.imageUrl}
        <img src={data.household.imageUrl} alt={data.household.name} class="household-avatar" />
      {/if}
      <div class="header-info">
        <h1>{data.household.name}</h1>
        <p class="member-line">
          <span>{data.members.length} {data.members.length === 1 ? 'member' : 'members'}</span>
          {#if data.userRole === 'admin' && !isNewHousehold}
            <button type="button" class="invite-link" onclick={() => (showInviteModal = true)}>
              + Invite Members
              {#if pendingCount > 0}
                <span class="pending-badge">
                  {pendingCount} pending
                </span>
              {/if}
            </button>
          {/if}
        </p>
      </div>
      {#if data.userRole === 'admin'}
        <div class="header-actions" class:has-cta={isNewHousehold}>
          {#if isNewHousehold}
            <Button variant="primary" size="lg" on:click={() => (showInviteModal = true)}
              >Invite Members</Button
            >
          {/if}
          <button
            type="button"
            class="settings-btn"
            title="Household Settings"
            onclick={() => (showSettingsModal = true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              width="22"
              height="22"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </button>
        </div>
      {/if}
    </div>

    <!-- Tab bar -->
    <nav class="tabs container" aria-label="Household sections">
      <a
        href={basePath}
        class="tab"
        class:active={isExpensesTab}
        aria-current={isExpensesTab ? 'page' : undefined}
      >
        Expenses
      </a>
      <a
        href="{basePath}/shopping"
        class="tab"
        class:active={isShoppingTab}
        aria-current={isShoppingTab ? 'page' : undefined}
      >
        Shopping List
        <span class="tab-count" class:empty={data.openShoppingItems === 0}>
          {data.openShoppingItems}
        </span>
      </a>
    </nav>
  </header>

  {@render children()}
</div>

{#if data.userRole === 'admin'}
  <InviteMemberModal
    bind:open={showInviteModal}
    pendingInvites={data.pendingInvites}
    householdId={data.household.id}
    suggestions={data.inviteSuggestions}
    {form}
  />

  <HouseholdSettingsModal
    bind:open={showSettingsModal}
    householdName={data.household.name}
    householdId={data.household.id}
    isArchived={data.household.archivedAt !== null}
    members={data.members}
    currentUserId={data.currentUserId}
  />
{/if}

<style>
  .household-container {
    min-height: 100vh;
    background-color: var(--color-bg-secondary);
  }

  /* Sits above the header so it is the first thing read on any tab */
  .archived-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-xs) var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background-color: color-mix(in srgb, var(--color-warning) 16%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--color-warning) 45%, transparent);
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }

  .archived-banner span {
    color: var(--color-text-secondary);
  }

  .household-header {
    background-color: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
  }

  /* The header sticks as a whole: a sticky child cannot escape its parent, and
     this header is only as tall as its content, so sticking .header-content
     alone did nothing once the header scrolled past.
     The banner is allowed to scroll out of view by offsetting upward by its own
     height, which keeps the name, member count and tabs pinned without the
     banner eating a phone screen. --navbar-height is measured by Header.svelte
     so the offset cannot drift. */
  .household-header {
    position: sticky;
    top: calc(var(--navbar-height, 5.5rem) - var(--banner-height, 0px));
    z-index: 40;
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

  .member-line {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  /* Small once the household is established: still reachable, no longer a CTA.
     Sized for a comfortable tap without competing with Split the Cost. */
  .invite-link {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .invite-link:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* Outstanding invites are worth surfacing without opening the modal */
  .pending-badge {
    margin-left: var(--space-xs);
    padding: 1px 0.4rem;
    border-radius: 999px;
    background-color: color-mix(in srgb, var(--color-warning) 22%, transparent);
    color: var(--color-warning);
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: var(--space-md);
    align-items: center;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .settings-btn:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border-color: var(--color-text-tertiary);
  }

  /* Tab bar */
  .tabs {
    display: flex;
    gap: var(--space-sm);
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
    padding: var(--space-md) var(--space-lg);
    /* Comfortable touch target on mobile */
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-decoration: none;
    white-space: nowrap;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    /* Sits on the header's bottom border so the active tab merges with the page */
    margin-bottom: -1px;
    transition:
      color 0.15s ease,
      background-color 0.15s ease;
  }

  .tab:hover:not(.active) {
    color: var(--color-text-primary);
    background-color: var(--color-bg-secondary);
  }

  .tab.active {
    color: var(--color-primary);
    background-color: var(--color-bg-secondary);
    border-color: var(--color-border);
    box-shadow: inset 0 3px 0 var(--color-primary);
  }

  /* Count chip — always rendered, muted at zero */
  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background-color: var(--color-primary);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .tab-count.empty {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
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

    .header-actions.has-cta {
      width: 100%;
    }

    .header-actions :global(.btn) {
      flex: 1;
    }

    .tabs {
      padding: 0 var(--space-sm);
      gap: 2px;
    }

    /* Split the width evenly so both tabs are full-size touch targets */
    .tab {
      flex: 1;
      justify-content: center;
      padding: var(--space-md) var(--space-sm);
      font-size: 0.98rem;
    }
  }
</style>
