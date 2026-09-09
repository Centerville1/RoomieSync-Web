<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import Header from '$lib/components/Header.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { PAYMENT_PROVIDERS, providerById, formatHandle, paymentLink } from '$lib/payment-methods';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let name = $state(data.user.name);

  // Providers the user has not added yet: one row each, so the add form only
  // offers what is still available.
  const availableProviders = $derived(
    PAYMENT_PROVIDERS.filter((p) => !data.paymentMethods.some((m) => m.provider === p.id))
  );
  let newProvider = $state(PAYMENT_PROVIDERS[0].id as string);
  let newHandle = $state('');
  let editingId = $state<string | null>(null);
  let editHandle = $state('');

  const newProviderMeta = $derived(providerById(newProvider));

  $effect(() => {
    // Keep the picker on something addable as methods come and go
    if (availableProviders.length > 0 && !availableProviders.some((p) => p.id === newProvider)) {
      newProvider = availableProviders[0].id;
    }
  });

  function startEdit(id: string, handle: string) {
    editingId = id;
    editHandle = handle;
  }
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

      <!-- How people pay you back -->
      <Card padding="lg">
        <h2 id="getting-paid">Getting paid</h2>
        <p class="section-description">
          Tell your households how to pay you back. Your preferred method is shown first when
          someone settles up with you, and everything here is visible only to people you share a
          household with.
        </p>

        {#if data.paymentMethods.length > 0}
          <ul class="method-list">
            {#each data.paymentMethods as method (method.id)}
              {@const meta = providerById(method.provider)}
              {@const link = paymentLink(method.provider, method.handle)}
              <li class="method" class:preferred={method.isPreferred}>
                <div class="method-head">
                  <span class="method-name">{meta?.name ?? method.provider}</span>
                  {#if method.isPreferred}
                    <span class="pill-preferred">Preferred</span>
                  {/if}
                  {#if !link}
                    <span class="pill-copy">Copy only</span>
                  {/if}
                </div>

                {#if editingId === method.id}
                  <form
                    method="POST"
                    action="?/updatePaymentMethod"
                    class="method-edit"
                    use:enhance={() => {
                      return async ({ result, update }) => {
                        await update();
                        if (result.type === 'success') editingId = null;
                      };
                    }}
                  >
                    <input type="hidden" name="methodId" value={method.id} />
                    <input
                      class="handle-input"
                      name="handle"
                      bind:value={editHandle}
                      placeholder={meta?.handlePlaceholder}
                      autocomplete="off"
                      required
                    />
                    <Button type="submit" variant="primary" size="sm">Save</Button>
                    <button type="button" class="text-btn" onclick={() => (editingId = null)}>
                      Cancel
                    </button>
                  </form>
                {:else}
                  <div class="method-body">
                    <span class="handle">{formatHandle(method.provider, method.handle)}</span>
                    <div class="method-actions">
                      {#if !method.isPreferred}
                        <form method="POST" action="?/setPreferredPaymentMethod" use:enhance>
                          <input type="hidden" name="methodId" value={method.id} />
                          <button type="submit" class="text-btn">Make preferred</button>
                        </form>
                      {/if}
                      <button
                        type="button"
                        class="text-btn"
                        onclick={() => startEdit(method.id, method.handle)}
                      >
                        Edit
                      </button>
                      <form method="POST" action="?/deletePaymentMethod" use:enhance>
                        <input type="hidden" name="methodId" value={method.id} />
                        <button type="submit" class="text-btn danger">Remove</button>
                      </form>
                    </div>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="method-empty">
            Nothing here yet. Add a method so people can pay you back without asking how.
          </p>
        {/if}

        <!-- One saved and no fallback: worth saying once, here, where the
             person is already looking at the list. -->
        {#if data.paymentMethods.length === 1}
          <p class="method-nudge">
            Add a second method so someone who cannot use
            {providerById(data.paymentMethods[0].provider)?.name ?? 'that one'} still has a way to pay
            you.
          </p>
        {/if}

        {#if availableProviders.length > 0}
          <form
            method="POST"
            action="?/addPaymentMethod"
            class="method-add"
            use:enhance={() => {
              return async ({ result, update }) => {
                await update();
                if (result.type === 'success') newHandle = '';
              };
            }}
          >
            <div class="add-row">
              <select bind:value={newProvider} name="provider" aria-label="Payment method">
                {#each availableProviders as provider (provider.id)}
                  <option value={provider.id}>{provider.name}</option>
                {/each}
              </select>
              <input
                class="handle-input"
                name="handle"
                bind:value={newHandle}
                placeholder={newProviderMeta?.handlePlaceholder}
                aria-label={newProviderMeta?.handleLabel}
                autocomplete="off"
                required
              />
              <Button type="submit" variant="primary" size="sm" disabled={newHandle.trim() === ''}>
                Add
              </Button>
            </div>
            {#if newProviderMeta?.hint}
              <p class="add-hint">{newProviderMeta.hint}</p>
            {/if}
          </form>
        {/if}

        {#if form?.action?.startsWith('addPaymentMethod') || form?.action?.includes('PaymentMethod')}
          {#if form?.error}
            <p class="method-error">{form.error}</p>
          {/if}
        {/if}
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
  .method-nudge {
    margin: 0 0 var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-left: 3px solid var(--color-secondary);
    border-radius: var(--radius-sm);
    background-color: color-mix(in srgb, var(--color-secondary) 8%, transparent);
    color: var(--color-text-secondary);
    font-size: 0.84rem;
    line-height: 1.45;
  }

  .method-list {
    list-style: none;
    margin: 0 0 var(--space-md);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .method {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
  }

  .method.preferred {
    border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
  }

  .method-head {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .method-name {
    color: var(--color-text-primary);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .pill-preferred,
  .pill-copy {
    padding: 1px 0.45rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
  }

  .pill-preferred {
    background-color: color-mix(in srgb, var(--color-success) 18%, transparent);
    color: var(--color-success);
  }

  /* Says plainly that this one has no app to open, rather than leaving
     someone to wonder why there is no link. */
  .pill-copy {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
  }

  .method-body,
  .method-edit {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-top: 2px;
    flex-wrap: wrap;
  }

  .handle {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .method-actions {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-left: auto;
  }

  .method-actions form {
    display: contents;
  }

  .text-btn {
    min-height: 32px;
    padding: 0 var(--space-xs);
    border: none;
    background: none;
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .text-btn:hover {
    color: var(--color-text-primary);
  }

  .text-btn.danger:hover {
    color: var(--color-error);
  }

  .method-empty {
    margin: 0 0 var(--space-md);
    padding: var(--space-md);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.88rem;
    text-align: center;
  }

  .add-row {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
    flex-wrap: wrap;
  }

  .handle-input,
  .add-row select {
    min-width: 0;
    /* 16px minimum stops iOS Safari zooming the page on focus */
    font-size: 16px;
    min-height: 44px;
    padding: 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: inherit;
  }

  .handle-input {
    flex: 1;
  }

  .handle-input:focus,
  .add-row select:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
    border-color: var(--color-primary);
  }

  .add-hint {
    margin: var(--space-xs) 0 0;
    color: var(--color-text-tertiary);
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .method-error {
    margin: var(--space-sm) 0 0;
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
    color: var(--color-error);
    font-size: 0.85rem;
  }

  @media (max-width: 767px) {
    .method-actions {
      margin-left: 0;
    }
  }

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
