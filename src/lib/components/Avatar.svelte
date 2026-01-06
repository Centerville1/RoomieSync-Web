<script lang="ts">
  export let src = '';
  export let alt = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let fallback = '';
</script>

<div class="avatar avatar-{size}">
  {#if src}
    <img {src} {alt} class="avatar-img" />
  {:else}
    <span class="avatar-fallback">{fallback}</span>
  {/if}
</div>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    color: var(--color-text-inverse);
    font-weight: 600;
    flex-shrink: 0;
  }

  .avatar-sm {
    width: 2rem;
    height: 2rem;
    font-size: 0.875rem;
  }

  .avatar-md {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }

  .avatar-lg {
    width: 4rem;
    height: 4rem;
    font-size: 1.5rem;
  }

  .avatar-xl {
    width: 6rem;
    height: 6rem;
    font-size: 2rem;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    text-transform: uppercase;
  }
</style>
