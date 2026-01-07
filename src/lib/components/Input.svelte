<script lang="ts">
  export let type: 'text' | 'email' | 'password' | 'number' | 'date' | 'tel' = 'text';
  export let value = '';
  export let label = '';
  export let placeholder = '';
  export let error = '';
  export let disabled = false;
  export let required = false;
  export let id = '';
  export let name = '';
  // Number-specific props
  export let min: number | string | undefined = undefined;
  export let max: number | string | undefined = undefined;
  export let step: number | string | undefined = undefined;
  // Password toggle
  export let showPasswordToggle = false;

  let showPassword = false;

  $: inputType = type === 'password' && showPassword ? 'text' : type;

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<div class="input-group">
  {#if label}
    <label for={id} class="label"
      >{label}{#if required}<span class="required">*</span>{/if}</label
    >
  {/if}
  <div class="input-wrapper" class:has-toggle={type === 'password' && showPasswordToggle}>
    <input
      {id}
      {name}
      type={inputType}
      {placeholder}
      {disabled}
      {required}
      {min}
      {max}
      {step}
      bind:value
      class="input"
      class:error
    />
    {#if type === 'password' && showPasswordToggle}
      <button
        type="button"
        class="toggle-password"
        onclick={togglePasswordVisibility}
        tabindex="-1"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {#if showPassword}
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
              d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
            />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        {:else}
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        {/if}
      </button>
    {/if}
  </div>
  {#if error}
    <span class="error-text">{error}</span>
  {/if}
</div>

<style>
  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .required {
    color: var(--color-error);
    margin-left: 2px;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-wrapper.has-toggle .input {
    padding-right: 2.75rem;
  }

  .input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: var(--font-sans);
    color: var(--color-text-primary);
    background-color: var(--color-bg-primary);
    transition: all 0.2s;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(107, 127, 255, 0.1);
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--color-bg-tertiary);
  }

  .input.error {
    border-color: var(--color-error);
  }

  .input.error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .toggle-password {
    position: absolute;
    right: var(--space-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xs);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-tertiary);
    transition: color 0.2s;
  }

  .toggle-password:hover {
    color: var(--color-text-primary);
  }

  .toggle-password svg {
    display: block;
  }

  .error-text {
    font-size: 0.875rem;
    color: var(--color-error);
  }
</style>
