<script lang="ts">
  import Button from './Button.svelte';

  interface Props {
    user?: { name: string } | null;
    showBackButton?: boolean;
    backHref?: string;
    backLabel?: string;
  }

  let { user = null, showBackButton = false, backHref = '/', backLabel = 'Back' }: Props = $props();
</script>

<nav class="navbar">
  <div class="container">
    <div class="nav-left">
      <a href="/" class="logo-container">
        <img src="/icon-nobg.png" alt="RoomieSync" class="logo-icon" />
        <h2 class="logo">RoomieSync</h2>
      </a>
      {#if showBackButton}
        <a href={backHref} class="back-link">
          <Button variant="ghost" size="sm">← {backLabel}</Button>
        </a>
      {/if}
    </div>
    <div class="nav-links">
      {#if user}
        <span class="welcome">Welcome, {user.name}!</span>
        <a href="/settings" class="settings-link" title="Settings">
          <Button variant="ghost" size="sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
        </a>
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

<style>
  .navbar {
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    padding: var(--space-md) 0;
  }

  .navbar .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-md);
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .logo-container {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    text-decoration: none;
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

  .back-link {
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: var(--space-md);
    align-items: center;
  }

  .nav-links a {
    text-decoration: none;
  }

  .welcome {
    color: var(--color-text-primary);
  }

  .settings-link {
    display: flex;
    align-items: center;
  }

  .settings-link :global(.btn) {
    padding: var(--space-sm);
  }

  .settings-link svg {
    display: block;
  }

  @media (max-width: 640px) {
    .welcome {
      display: none;
    }

    .logo {
      display: none;
    }
  }
</style>
