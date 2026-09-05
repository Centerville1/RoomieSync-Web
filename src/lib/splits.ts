/**
 * Reading what someone owes on an expense.
 *
 * Shares are stored per split row so an expense can be divided unevenly. This
 * module is the single place that answers "what does this person owe?", so the
 * rule cannot drift between the grid, the pay modal, the delete confirmation
 * and everything else that used to divide `amount` by the split count.
 *
 * Nothing outside this module should compute a share as amount/count. Doing so
 * silently ignores overrides.
 */

type SplitLike = {
  userId: string;
  amount?: number | null;
  hasPaid?: boolean;
};

type ExpenseLike = {
  amount: number;
  splits: SplitLike[];
};

/**
 * What one person owes on an expense.
 *
 * Returns 0 when they are not part of the split.
 *
 * Rows written before per-split amounts existed have a null amount and fall
 * back to an even share. Every existing row was backfilled, so this is a guard
 * against rows created by older code paths rather than an expected case; when
 * the column becomes NOT NULL this fallback is the only thing to delete.
 */
export function shareFor(expense: ExpenseLike, userId: string): number {
  const split = expense.splits.find((s) => s.userId === userId);
  if (!split) return 0;
  if (split.amount !== null && split.amount !== undefined) return split.amount;
  return expense.splits.length > 0 ? expense.amount / expense.splits.length : 0;
}

/** Whether this person still owes on the expense. */
export function isUnpaidBy(expense: ExpenseLike, userId: string): boolean {
  const split = expense.splits.find((s) => s.userId === userId);
  return split !== undefined && split.hasPaid !== true;
}

/**
 * Total one person owes across several expenses, counting only unpaid splits.
 */
export function unpaidTotalFor(expenses: ExpenseLike[], userId: string): number {
  return expenses.reduce((sum, e) => (isUnpaidBy(e, userId) ? sum + shareFor(e, userId) : sum), 0);
}

/**
 * What one person owes, grouped by who they owe it to.
 *
 * Sums the raw shares and leaves rounding to the caller's formatter, so a
 * per-expense rounding error cannot accumulate across a long list.
 */
export function owedByCreator(
  expenses: (ExpenseLike & { creatorId: string })[],
  userId: string
): Map<string, number> {
  const owed = new Map<string, number>();
  for (const e of expenses) {
    const share = shareFor(e, userId);
    if (share === 0) continue;
    owed.set(e.creatorId, (owed.get(e.creatorId) ?? 0) + share);
  }
  return owed;
}

/**
 * Preview what shares would become if the split membership changed.
 *
 * Distinct from shareFor: this is a forecast for the edit form, not stored
 * data. Existing overrides are deliberately not carried over, because the
 * question being answered is "what would an even split look like now".
 */
export function previewEvenShare(total: number, memberCount: number): number {
  if (memberCount <= 0) return 0;
  return total / memberCount;
}

/** Round to whole cents. Money is stored as a float, so this keeps sums exact. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export type SplitInput = {
  userId: string;
  /** Set to pin this person's share. Undefined means "take an even share of the rest". */
  override?: number;
};

export type SplitResult = { userId: string; amount: number };

/**
 * Work out what each person owes.
 *
 * Overridden shares are honoured exactly. Whatever is left over is divided
 * evenly between the people without an override. Remainder pennies go to
 * `remainderTo` (the expense creator), who has already paid the full amount up
 * front, so absorbing a cent is the least surprising place to put it.
 *
 * The returned amounts always sum to `total` exactly, in cents.
 */
export function calculateSplits(
  total: number,
  people: SplitInput[],
  remainderTo: string
): SplitResult[] {
  const totalCents = toCents(total);

  const overridden = people.filter((p) => p.override !== undefined);
  const even = people.filter((p) => p.override === undefined);

  const overriddenCents = new Map(overridden.map((p) => [p.userId, toCents(p.override as number)]));
  const usedCents = [...overriddenCents.values()].reduce((sum, c) => sum + c, 0);

  // Everything pinned already, or nobody left to share the rest
  if (even.length === 0) {
    return people.map((p) => ({
      userId: p.userId,
      amount: fromCents(overriddenCents.get(p.userId) ?? 0)
    }));
  }

  // Overrides can exceed the total; clamp so nobody is assigned a negative share
  const remainingCents = Math.max(0, totalCents - usedCents);
  const baseCents = Math.floor(remainingCents / even.length);
  let leftover = remainingCents - baseCents * even.length;

  const evenCents = new Map<string, number>();
  // Give the leftover pennies to the creator first if they are taking an even
  // share, otherwise spread them over the first few people deterministically.
  const creatorFirst = [
    ...even.filter((p) => p.userId === remainderTo),
    ...even.filter((p) => p.userId !== remainderTo)
  ];
  for (const p of creatorFirst) {
    const extra = leftover > 0 ? 1 : 0;
    leftover -= extra;
    evenCents.set(p.userId, baseCents + extra);
  }

  return people.map((p) => ({
    userId: p.userId,
    amount: fromCents(overriddenCents.get(p.userId) ?? evenCents.get(p.userId) ?? 0)
  }));
}

/**
 * Whether these stored shares are anything other than a plain even split.
 *
 * Not a simple "do they all equal amount/count": an even split of $10 three
 * ways is stored as 3.34/3.33/3.33, because the remainder penny has to go
 * somewhere. Comparing against the unrounded 3.3333 average would call that
 * uneven. So this compares against what calculateSplits actually produces for
 * an even split, which is the only definition that round-trips.
 */
export function isUnevenSplit(
  total: number,
  splits: { userId: string; amount?: number | null }[],
  creatorId: string
): boolean {
  if (splits.length === 0) return false;

  // A row with no stored amount was written before per-split amounts existed
  // and is taking an even share by fallback. Nothing about it was set by hand,
  // so an expense containing one is not an uneven split.
  if (splits.some((s) => s.amount === null || s.amount === undefined)) return false;

  const even = calculateSplits(
    total,
    splits.map((s) => ({ userId: s.userId })),
    creatorId
  );
  const evenByUser = new Map(even.map((e) => [e.userId, toCents(e.amount)]));
  return splits.some((s) => toCents(s.amount as number) !== evenByUser.get(s.userId));
}

/**
 * Validate a set of split amounts against the expense total.
 *
 * Compared in cents so float noise never makes a correct split look wrong.
 */
export function splitsMatchTotal(total: number, amounts: number[]): boolean {
  const sum = amounts.reduce((acc, a) => acc + toCents(a), 0);
  return sum === toCents(total);
}

/** The largest expense we will accept. Guards against Infinity and typos. */
export const MAX_EXPENSE_AMOUNT = 1_000_000;

/**
 * Parse and validate a posted expense amount.
 *
 * Returns null when the value is not a usable amount. parseFloat alone is not
 * enough: it yields Infinity for "1e400", NaN for junk, and 5 for "5abc", and
 * `!amount || amount <= 0` lets Infinity through. An Infinity amount poisons
 * every balance SUM in the household.
 */
export function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Number() rejects trailing garbage where parseFloat silently truncates it
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_EXPENSE_AMOUNT) return null;
  return Math.round(value * 100) / 100;
}
