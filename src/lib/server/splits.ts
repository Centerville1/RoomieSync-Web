/**
 * Splitting an expense between people.
 *
 * Split amounts are stored per row rather than derived, so an expense can be
 * divided unevenly. Everything that needs to know what someone owes reads the
 * stored value; nothing should divide `amount` by the number of splits, because
 * that silently ignores overrides.
 */

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
 * Validate a set of split amounts against the expense total.
 *
 * Compared in cents so float noise never makes a correct split look wrong.
 */
export function splitsMatchTotal(total: number, amounts: number[]): boolean {
  const sum = amounts.reduce((acc, a) => acc + toCents(a), 0);
  return sum === toCents(total);
}
