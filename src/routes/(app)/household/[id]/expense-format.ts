/**
 * Formatting shared by the expense views.
 *
 * These were copy-pasted across six components, which is how the same date
 * ended up rendering three different ways depending on where you looked.
 * Money and dates are the two things a household expense app is judged on, so
 * they get one definition each.
 */

export type NamedMember = { name: string; displayName: string | null };

/** Household nickname if there is one, otherwise the account name. */
export function getMemberDisplayName(member: NamedMember) {
  return member.displayName || member.name;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * "Sep 3, 2:14 PM".
 *
 * The `new Date(...)` wrapper is load-bearing: rows from the first page arrive
 * as Date objects, but rows paged in through /api/household/[id]/expenses come
 * back as JSON strings. Without it those later rows render "Invalid Date",
 * which only shows up after scrolling.
 */
export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(date));
}

/** "9/3, 2:14 PM". Used where space is tight, e.g. a paid-on stamp. */
export function formatShortDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(date));
}

/** "Sep 3". Date only, for a row that already says the year elsewhere. */
export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
}

/**
 * A stored due date ("2026-09-01") as "Sep 1".
 *
 * Parsed as UTC on purpose: a bare date string through the local Date
 * constructor lands on the previous day for anyone west of UTC, so the rent
 * would show as due a day early for half the world.
 */
export function formatDueDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

/** Whole days from today to a stored due date. Negative once it has passed. */
export function daysUntil(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const due = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}
