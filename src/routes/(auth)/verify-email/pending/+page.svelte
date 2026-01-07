<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
</script>

<div class="verify-container">
  <Card padding="lg" shadow="lg">
    <div class="verify-content">
      <div class="icon">
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
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>
      <h1>Check Your Email</h1>
      <p class="message">
        We've sent a verification link to your email address. Please click the link to verify your
        account.
      </p>
      <p class="note">The link will expire in 24 hours.</p>

      <div class="actions">
        <a href="/login"><Button variant="primary" fullWidth>Back to Login</Button></a>
      </div>

      <p class="footer">
        Didn't receive the email? Check your spam folder or <a href="/signup"
          >try signing up again</a
        >.
      </p>
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
    color: var(--color-primary);
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
    margin: 0 0 var(--space-sm) 0;
  }

  .note {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: 0 0 var(--space-xl) 0;
  }

  .actions {
    margin-bottom: var(--space-lg);
  }

  .footer {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .footer a {
    color: var(--color-secondary);
    font-weight: 600;
    text-decoration: none;
  }

  .footer a:hover {
    text-decoration: underline;
  }
</style>
