<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import { formatCurrency, getMemberDisplayName } from './expense-format';

  type Member = { id: string; name: string; displayName: string | null };
  type MemberBalance = {
    owesYou: number;
    owesYouOptional: number;
    youOwe: number;
    youOweOptional: number;
  };
  type NudgeSent = { toUserId: string; createdAt: Date };

  let {
    members = [],
    currentUserId,
    memberBalances = {},
    nudgesSent = [],
    onNudge
  }: {
    members?: Member[];
    currentUserId: string;
    memberBalances?: Record<string, MemberBalance>;
    nudgesSent?: NudgeSent[];
    onNudge?: (memberId: string, memberName: string, amountOwed: number) => void;
  } = $props();

  // Everyone but me: my own balance with myself is always zero
  const others = $derived(members.filter((m) => m.id !== currentUserId));

  // Set when someone taps a chip whose reminder is unavailable, so the reason
  // is stated rather than left to a tooltip nobody sees on a phone.
  let blockedFor = $state<{ name: string; reason: string } | null>(null);
  // Modal drives `open` itself (escape, backdrop, close button), so it gets its
  // own state and clearing it clears the reason with it.
  let blockedOpen = $state(false);
  $effect(() => {
    if (!blockedOpen) blockedFor = null;
  });

  // Nudging is for reminding someone who owes you. Not available if you owe
  // them too, since settling up is then a conversation rather than a reminder.
  function canNudge(memberId: string): { canNudge: boolean; reason?: string } {
    const balance = memberBalances[memberId];
    if (!balance) return { canNudge: false, reason: 'No balance data' };

    if (balance.owesYou <= 0) return { canNudge: false, reason: "They don't owe you money" };
    if (balance.youOwe > 0) return { canNudge: false, reason: 'Settle your debts first' };

    const recentNudge = nudgesSent.find((n) => n.toUserId === memberId);
    if (recentNudge) {
      const hoursAgo = Math.floor(
        (Date.now() - new Date(recentNudge.createdAt).getTime()) / (60 * 60 * 1000)
      );
      const hoursRemaining = 24 - hoursAgo;
      if (hoursRemaining > 0) {
        return { canNudge: false, reason: `Wait ${hoursRemaining}h to nudge again` };
      }
    }

    return { canNudge: true };
  }

  function getNudgeBadgeText(memberId: string): string | null {
    const recentNudge = nudgesSent.find((n) => n.toUserId === memberId);
    if (!recentNudge) return null;
    const hoursAgo = Math.floor(
      (Date.now() - new Date(recentNudge.createdAt).getTime()) / (60 * 60 * 1000)
    );
    if (hoursAgo >= 24) return null;
    return `Reminded ${hoursAgo}h ago`;
  }
</script>

{#if others.length > 0}
  <ul class="balances">
    {#each others as member (member.id)}
      {@const balance = memberBalances[member.id]}
      {@const nudgeStatus = canNudge(member.id)}
      {@const nudgeBadge = getNudgeBadgeText(member.id)}
      {@const settled =
        !balance ||
        (balance.owesYou === 0 &&
          balance.youOwe === 0 &&
          balance.owesYouOptional === 0 &&
          balance.youOweOptional === 0)}
      {@const canRemind = balance && balance.owesYou > 0 && !!onNudge}
      <li>
        {#snippet content()}
          <span class="who">{getMemberDisplayName(member)}</span>

          <span class="figures">
            {#if settled}
              <span class="settled">Settled up</span>
            {:else}
              {#if balance.owesYou > 0}
                <span class="owes-you">Owes you {formatCurrency(balance.owesYou)}</span>
              {/if}
              {#if balance.youOwe > 0}
                <span class="you-owe">You owe {formatCurrency(balance.youOwe)}</span>
              {/if}
              {#if balance.owesYouOptional > 0 || balance.youOweOptional > 0}
                <span class="opt">
                  {formatCurrency(balance.owesYouOptional + balance.youOweOptional)} optional
                </span>
              {/if}
            {/if}
          </span>

          {#if canRemind}
            <span class="bell" class:blocked={!nudgeStatus.canNudge} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                {#if !nudgeStatus.canNudge}
                  <!-- Crossed out: the reminder is unavailable, and saying so
                       on the icon beats leaving the whole chip looking dead. -->
                  <line x1="3" y1="3" x2="21" y2="21" />
                {/if}
              </svg>
            </span>
          {/if}
        {/snippet}

        <!-- The whole chip is the button when there is someone to remind, so
             there is no small target to hit. With nobody to remind it is inert
             markup rather than a disabled control. -->
        {#if canRemind}
          <!-- Never disabled: a chip carrying real balances has to stay
               readable. A blocked reminder explains itself on click instead. -->
          <button
            type="button"
            class="chip actionable"
            class:settled-chip={settled}
            title={nudgeBadge ?? (nudgeStatus.canNudge ? 'Send a reminder' : nudgeStatus.reason)}
            aria-label={nudgeStatus.canNudge
              ? `Remind ${getMemberDisplayName(member)}, owes you ${formatCurrency(balance.owesYou)}`
              : `Cannot remind ${getMemberDisplayName(member)}: ${nudgeStatus.reason}`}
            onclick={() => {
              if (nudgeStatus.canNudge) {
                onNudge?.(member.id, getMemberDisplayName(member), balance.owesYou);
              } else {
                blockedFor = {
                  name: getMemberDisplayName(member),
                  reason: nudgeStatus.reason ?? ''
                };
                blockedOpen = true;
              }
            }}
          >
            {@render content()}
          </button>
        {:else}
          <div class="chip" class:settled-chip={settled}>
            {@render content()}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<Modal bind:open={blockedOpen} title="Pay your debts first" size="sm">
  {#snippet children()}
    <p class="blocked-text">
      {#if blockedFor?.reason.startsWith('Wait')}
        You have already reminded {blockedFor?.name} recently. {blockedFor?.reason}.
      {:else}
        You owe {blockedFor?.name} money too. Settle up with them before sending a reminder.
      {/if}
    </p>
  {/snippet}
  {#snippet footer()}
    <Button variant="primary" on:click={() => (blockedOpen = false)}>Got it</Button>
  {/snippet}
</Modal>

<style>
  .blocked-text {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* A wrapping row of chips rather than one full-width row per person: with
     several members the per-row layout left a wide empty gutter and the
     amounts drifted to a ragged right edge. */
  .balances {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin: 0 0 var(--space-sm);
    padding: 0;
  }

  /* Every chip is the same height whatever it holds, so a row of them has no
     awkward steps. Three lines of figures is the tallest case. */
  .chip {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    height: 58px;
    padding: 0 var(--space-sm) 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: var(--color-bg-primary);
    color: inherit;
    font-family: inherit;
    white-space: nowrap;
    text-align: left;
  }

  .chip.actionable {
    cursor: pointer;
  }

  .chip.actionable:hover {
    border-color: var(--color-primary);
    background-color: var(--color-bg-secondary);
  }

  .chip.actionable:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .chip.settled-chip {
    opacity: 0.6;
  }

  .who {
    color: var(--color-text-primary);
    font-size: 0.82rem;
    font-weight: 700;
  }

  .figures {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    margin-left: auto;
    line-height: 1.25;
  }

  .owes-you {
    color: var(--color-success);
    font-size: 0.76rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .you-owe {
    color: var(--color-error);
    font-size: 0.76rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .opt {
    color: var(--color-secondary);
    font-size: 0.68rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .settled {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
  }

  .bell {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .bell svg {
    width: 13px;
    height: 13px;
  }

  .bell.blocked {
    color: var(--color-text-tertiary);
  }

  .chip.actionable:hover .bell {
    background-color: var(--color-primary);
    color: white;
  }

  @media (max-width: 767px) {
    .balances {
      gap: 6px;
    }

    .who,
    .owes-you,
    .you-owe {
      font-size: 0.74rem;
    }
  }
</style>
