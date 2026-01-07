<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import Card from '$lib/components/Card.svelte';
  import Input from '$lib/components/Input.svelte';
  import Button from '$lib/components/Button.svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let password = $state('');
  let confirmPassword = $state('');
</script>

<div class="auth-container">
  <Card padding="lg" shadow="lg">
    <div class="auth-content">
      {#if form?.success}
        <h1>Password Reset!</h1>
        <p class="subtitle">Your password has been successfully changed</p>
        <div class="success-message">You can now sign in with your new password.</div>
        <div class="action-link">
          <a href="/login" class="btn-link">Go to Login</a>
        </div>
      {:else if !data.valid}
        <h1>Invalid Link</h1>
        <p class="subtitle">{data.error}</p>
        <div class="error-message">This password reset link is invalid or has expired.</div>
        <p class="auth-footer">
          <a href="/forgot-password">Request a new reset link</a>
        </p>
      {:else}
        <h1>Reset Password</h1>
        <p class="subtitle">Enter your new password</p>

        <form method="POST" class="auth-form">
          <input type="hidden" name="token" value={data.token} />

          {#if form?.error}
            <div class="error-message">
              {form.error}
            </div>
          {/if}

          <Input
            type="password"
            id="password"
            name="password"
            label="New Password"
            bind:value={password}
            required
            showPasswordToggle
          />

          <Input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm New Password"
            bind:value={confirmPassword}
            required
            showPasswordToggle
          />

          <Button type="submit" variant="secondary" fullWidth size="lg">Reset Password</Button>
        </form>

        <p class="auth-footer">
          Remember your password? <a href="/login">Sign in</a>
        </p>
      {/if}
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
    text-align: center;
  }

  .success-message {
    padding: var(--space-md);
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid var(--color-success);
    border-radius: var(--radius-md);
    color: var(--color-success);
    font-size: 0.875rem;
    text-align: center;
    margin-bottom: var(--space-lg);
  }

  .action-link {
    margin-top: var(--space-md);
  }

  .auth-footer {
    margin-top: var(--space-lg);
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .auth-footer a {
    color: var(--color-primary);
    font-weight: 600;
    text-decoration: none;
  }

  .auth-footer a:hover {
    text-decoration: underline;
  }

  .btn-link {
    display: block;
    width: 100%;
    padding: var(--space-md) var(--space-xl);
    background-color: var(--color-secondary);
    color: var(--color-text-inverse);
    text-align: center;
    text-decoration: none;
    font-weight: 600;
    font-size: 1.125rem;
    border-radius: var(--radius-md);
    transition: background-color 0.2s;
  }

  .btn-link:hover {
    background-color: var(--color-secondary-hover);
    text-decoration: none;
  }
</style>
