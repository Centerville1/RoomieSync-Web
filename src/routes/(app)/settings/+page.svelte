<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import Header from '$lib/components/Header.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Modal from '$lib/components/Modal.svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let name = $state(data.user.name);
  let showDeleteModal = $state(false);
  let deleteConfirmation = $state('');

  const canDelete = $derived(deleteConfirmation === 'DELETE');
</script>

<div class="settings-container">
  <Header user={data.user} showBackButton />

  <main class="container">
    <h1>Account Settings</h1>

    <div class="settings-sections">
      <!-- Profile Section -->
      <Card padding="lg">
        <h2>Profile</h2>
        <p class="section-description">Update your account information.</p>

        <form method="POST" action="?/updateName" class="profile-form">
          {#if form?.action === 'updateName' && form?.error}
            <div class="error-message">{form.error}</div>
          {/if}
          {#if form?.action === 'updateName' && form?.success}
            <div class="success-message">{form.message}</div>
          {/if}

          <Input label="Name" type="text" name="name" bind:value={name} required />

          <div class="form-row">
            <Input label="Email" type="email" value={data.user.email} disabled />
            <p class="helper-text">Email cannot be changed.</p>
          </div>

          <div class="form-actions">
            <Button type="submit" variant="primary">Save Changes</Button>
          </div>
        </form>
      </Card>

      <!-- Danger Zone -->
      <Card padding="lg">
        <h2 class="danger-title">Danger Zone</h2>
        <p class="section-description">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        <Button variant="danger" on:click={() => (showDeleteModal = true)}>Delete Account</Button>
      </Card>
    </div>
  </main>
</div>

<!-- Delete Account Confirmation Modal -->
<Modal bind:open={showDeleteModal} title="Delete Account" size="md">
  <div class="delete-modal-content">
    <p class="warning-text">
      This will permanently delete your account and all associated data, including:
    </p>
    <ul class="delete-list">
      <li>Your profile information</li>
      <li>All expenses you created</li>
      <li>Your household memberships</li>
      <li>Payment history</li>
    </ul>
    <p class="warning-text">
      <strong>This action cannot be undone.</strong>
    </p>

    <div class="confirm-input">
      <label for="delete-confirm">Type <strong>DELETE</strong> to confirm:</label>
      <Input
        type="text"
        id="delete-confirm"
        name="confirm"
        bind:value={deleteConfirmation}
        placeholder="DELETE"
      />
    </div>

    <form method="POST" action="?/deleteAccount" class="delete-form-actions">
      <Button type="button" variant="outline" on:click={() => (showDeleteModal = false)}>
        Cancel
      </Button>
      <Button type="submit" variant="danger" disabled={!canDelete}>Delete My Account</Button>
    </form>
  </div>
</Modal>

<style>
  .settings-container {
    min-height: 100vh;
    background-color: var(--color-bg-secondary);
  }

  main {
    padding: var(--space-2xl) var(--space-md);
    max-width: 800px;
    margin: 0 auto;
  }

  h1 {
    margin: 0 0 var(--space-xl) 0;
    color: var(--color-text-primary);
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  h2 {
    margin: 0 0 var(--space-sm) 0;
    font-size: 1.25rem;
    color: var(--color-text-primary);
  }

  .danger-title {
    color: var(--color-error);
  }

  .section-description {
    margin: 0 0 var(--space-lg) 0;
    color: var(--color-text-secondary);
  }

  .profile-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .helper-text {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-start;
  }

  .error-message {
    padding: var(--space-md);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-md);
    color: var(--color-error);
    font-size: 0.875rem;
  }

  .success-message {
    padding: var(--space-md);
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid var(--color-success, #22c55e);
    border-radius: var(--radius-md);
    color: var(--color-success, #22c55e);
    font-size: 0.875rem;
  }

  .delete-modal-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .warning-text {
    margin: 0;
    color: var(--color-text-primary);
  }

  .delete-list {
    margin: 0;
    padding-left: var(--space-lg);
    color: var(--color-text-secondary);
  }

  .delete-list li {
    margin-bottom: var(--space-xs);
  }

  .confirm-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-top: var(--space-md);
  }

  .confirm-input label {
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .delete-form-actions {
    display: flex;
    gap: var(--space-md);
    justify-content: flex-end;
    margin-top: var(--space-lg);
  }
</style>
