<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Input from '$lib/components/Input.svelte';

  let { form, data }: { form: ActionData; data: PageData } = $props();

  // Use prefilled email from invite link, or fall back to form state
  let name = $derived(form?.name ?? '');
  let email = $state(data.prefillEmail || '');
  let password = $state('');
  let confirmPassword = $state('');

  // Track if email was prefilled from invite
  const fromInvite = data.prefillEmail && data.inviteId && data.sig;

  // Update email if form returns it (after validation error)
  $effect(() => {
    if (form?.email) {
      email = form.email;
    }
  });
</script>

<div class="auth-container">
  <Card padding="lg" shadow="lg">
    <div class="auth-content">
      <h1>Create Account</h1>
      <p class="subtitle">Join RoomieSync and start tracking expenses</p>

      <form method="POST" class="auth-form">
        {#if form?.error}
          <div class="error-message">
            {form.error}
          </div>
        {/if}

        {#if fromInvite}
          <div class="invite-notice">You're signing up from an invite link.</div>
          <!-- Hidden fields to pass invite data -->
          <input type="hidden" name="inviteId" value={data.inviteId} />
          <input type="hidden" name="sig" value={data.sig} />
          <input type="hidden" name="originalEmail" value={data.prefillEmail} />
        {/if}

        <Input type="text" id="name" name="name" label="Name" bind:value={name} required />

        <Input type="email" id="email" name="email" label="Email" bind:value={email} required />

        <Input
          type="password"
          id="password"
          name="password"
          label="Password"
          bind:value={password}
          required
          showPasswordToggle
        />

        <Input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm Password"
          bind:value={confirmPassword}
          required
          showPasswordToggle
        />

        <Button type="submit" variant="primary" fullWidth size="lg">Create Account</Button>
      </form>

      <p class="auth-footer">
        Already have an account? <a href="/login">Sign in</a>
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

  .invite-notice {
    padding: var(--space-md);
    background: rgba(107, 127, 255, 0.1);
    border: 1px solid var(--color-secondary);
    border-radius: var(--radius-md);
    color: var(--color-secondary);
    font-size: 0.875rem;
    text-align: center;
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
