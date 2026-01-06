<script lang="ts">
  import type { ActionData } from './$types';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Input from '$lib/components/Input.svelte';

  let { form }: { form: ActionData } = $props();

  let email = $derived(form?.email ?? '');
  let password = $state('');
</script>

<div class="auth-container">
  <Card padding="lg" shadow="lg">
    <div class="auth-content">
      <h1>Welcome Back</h1>
      <p class="subtitle">Sign in to your RoomieSync account</p>

      <form method="POST" class="auth-form">
        {#if form?.error}
          <div class="error-message">
            {form.error}
          </div>
        {/if}

        <Input type="email" id="email" name="email" label="Email" bind:value={email} required />

        <Input
          type="password"
          id="password"
          name="password"
          label="Password"
          bind:value={password}
          required
        />

        <Button type="submit" variant="primary" fullWidth size="lg">Sign In</Button>
      </form>

      <p class="auth-footer">
        Don't have an account? <a href="/signup">Sign up</a>
      </p>
    </div>
  </Card>
</div>

<style>
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-md);
    background-color: var(--color-bg-secondary);
  }

  .auth-container :global(.card) {
    width: 100%;
    max-width: 420px;
  }

  .auth-content {
    width: 100%;
  }

  h1 {
    margin: 0 0 var(--space-sm) 0;
    text-align: center;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    text-align: center;
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-xl) 0;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .error-message {
    padding: var(--space-md);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-md);
    color: var(--color-error);
    font-size: 0.875rem;
  }

  .auth-footer {
    margin-top: var(--space-lg);
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .auth-footer a {
    color: var(--color-secondary);
    font-weight: 600;
    text-decoration: none;
  }

  .auth-footer a:hover {
    text-decoration: underline;
  }
</style>
