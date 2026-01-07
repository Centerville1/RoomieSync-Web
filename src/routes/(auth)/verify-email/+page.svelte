<script lang="ts">
  import type { PageData } from './$types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';

  let { data }: { data: PageData } = $props();
</script>

<div class="verify-container">
  <Card padding="lg" shadow="lg">
    <div class="verify-content">
      {#if data.success}
        <div class="icon success">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h1>Email Verified!</h1>
        <p class="message">
          Your email has been successfully verified. You can now log in to your account.
        </p>

        <div class="actions">
          <a href="/login"><Button variant="primary" fullWidth>Log In</Button></a>
        </div>
      {:else}
        <div class="icon error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        </div>
        <h1>Verification Failed</h1>
        <p class="message">{data.error}</p>

        <div class="actions">
          <a href="/signup"><Button variant="primary" fullWidth>Sign Up Again</Button></a>
          <a href="/login"><Button variant="outline" fullWidth>Back to Login</Button></a>
        </div>
      {/if}
    </div>
  </Card>
</div>

<style>
  .verify-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
  }

  .verify-container :global(.card) {
    width: 100%;
    max-width: 420px;
  }

  .verify-content {
    text-align: center;
  }

  .icon {
    display: flex;
    justify-content: center;
    margin-bottom: var(--space-lg);
  }

  .icon.success {
    color: var(--color-success, #22c55e);
  }

  .icon.error {
    color: var(--color-error);
  }

  h1 {
    margin: 0 0 var(--space-md) 0;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .message {
    color: var(--color-text-primary);
    line-height: 1.6;
    margin: 0 0 var(--space-xl) 0;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
</style>
