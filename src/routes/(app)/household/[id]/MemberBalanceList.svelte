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
    onNudge,
    onPayPerson
  }: {
    members?: Member[];
    currentUserId: string;
    memberBalances?: Record<string, MemberBalance>;
    nudgesSent?: NudgeSent[];
    onNudge?: (memberId: string, memberName: string, amountOwed: number) => void;
    /** Select everything still owed to this person and open the pay flow. */
    onPayPerson?: (memberId: string) => void;
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

  // Two different reasons a reminder is unavailable, and they need different
  // titles: a cooldown is not a debt. Both the heading and the body read from
  // this one test so they cannot drift apart again.
  const isCooldown = $derived(blockedFor?.reason.startsWith('Wait') ?? false);
  const blockedTitle = $derived(isCooldown ? 'Already reminded' : 'Pay your debts first');

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
      {@const canPay = !!balance && balance.youOwe > 0 && !!onPayPerson}
      <!-- Paying takes precedence: when you owe them, settling up is the
           action available to you, and it is also what unblocks reminding. -->
      {@const canRemind = !canPay && !!balance && balance.owesYou > 0 && !!onNudge}
      <li>
        {#snippet content(showBell = false)}
          <span class="who">{getMemberDisplayName(member)}</span>

          <span class="figures">
            {#if settled}
              <span class="settled">Settled up</span>
            {:else}
              <!-- What you owe leads: paying it back is the action available to
                   you, and reminding is secondary to that. -->
              {#if balance.youOwe > 0}
                <span class="you-owe">You owe {formatCurrency(balance.youOwe)}</span>
              {/if}
              {#if balance.owesYou > 0}
                <span class="owes-you">Owes you {formatCurrency(balance.owesYou)}</span>
              {/if}
              {#if balance.owesYouOptional > 0 || balance.youOweOptional > 0}
                <span class="opt">
                  {formatCurrency(balance.owesYouOptional + balance.youOweOptional)} optional
                </span>
              {/if}
            {/if}
          </span>

          <!-- Shown on a chip that is entirely the remind target, so the action
               is visible. The pay chip passes false: it has its own bell button
               beside it, and two would read as two reminders. -->
          {#if showBell}
            <span class="bell" class:blocked={!nudgeStatus.canNudge} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                {#if !nudgeStatus.canNudge}
                  <line x1="3" y1="3" x2="21" y2="21" />
                {/if}
              </svg>
            </span>
          {/if}
        {/snippet}

        <!-- The whole chip is the button when there is someone to remind, so
             there is no small target to hit. With nobody to remind it is inert
             markup rather than a disabled control. -->
        {#if canPay}
          <!-- Two actions on one chip: the chip pays, and when they also owe
               you, a separate bell says why reminding is unavailable. Siblings
               in a wrapper, never nested, so a tap can only hit one. -->
          <span class="chip-pair">
            <button
              type="button"
              class="chip actionable pairs"
              title="Pay {getMemberDisplayName(member)} {formatCurrency(balance.youOwe)}"
              aria-label="Pay {getMemberDisplayName(member)} {formatCurrency(balance.youOwe)}"
              onclick={() => onPayPerson?.(member.id)}
            >
              {@render content()}
            </button>
            {#if balance.owesYou > 0 && onNudge}
              <button
                type="button"
                class="bell-btn"
                title={nudgeStatus.reason ?? 'Send a reminder'}
                aria-label={nudgeStatus.canNudge
                  ? `Remind ${getMemberDisplayName(member)}`
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
                <span class="bell" class:blocked={!nudgeStatus.canNudge}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    {#if !nudgeStatus.canNudge}
                      <line x1="3" y1="3" x2="21" y2="21" />
                    {/if}
                  </svg>
                </span>
              </button>
            {/if}
          </span>
        {:else if canRemind}
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
            {@render content(true)}
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

<Modal bind:open={blockedOpen} title={blockedTitle} size="sm">
  {#snippet children()}
    <p class="blocked-text">
      {#if isCooldown}
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

  /* The pay chip and its bell read as one control, so they share a border */
  .chip-pair {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .chip.pairs {
    border: none;
    border-radius: 0;
  }

  .bell-btn {
    display: grid;
    place-items: center;
    width: 42px;
    padding: 0;
    border: none;
    border-left: 1px solid var(--color-border);
    background: none;
    cursor: pointer;
  }

  .bell-btn:hover {
    background-color: var(--color-bg-secondary);
  }

  .bell-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
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

  .bell-btn:hover .bell {
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
