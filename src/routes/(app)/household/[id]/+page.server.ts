import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/client';
import {
  households,
  householdMembers,
  users,
  expenses,
  expenseSplits,
  expenseTags,
  invites,
  nudgeHistory
} from '$lib/server/db/schema';
import { eq, and, ne, asc, desc, inArray, count, sql, gt } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';
import { sendEmail } from '$lib/server/email';
import { getHouseholdInviteEmail, getNudgeReminderEmail } from '$lib/server/email/templates';
import { createInviteSignature } from '$lib/server/invite-signature';
import { requireAdmin, requireMembership } from '$lib/server/household';
import { calculateSplits, splitsMatchTotal, parseAmount } from '$lib/server/splits';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ locals, params, parent }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const householdId = params.id;

  // Household, membership check, and members come from +layout.server.ts
  const { members } = await parent();

  // Get total expense count for pagination
  const totalCountResult = await db
    .select({ count: count() })
    .from(expenses)
    .where(eq(expenses.householdId, householdId));
  const totalExpenses = totalCountResult[0]?.count ?? 0;

  // Fetch first page of expenses for this household with creator info
  const householdExpenses = await db
    .select({
      expense: expenses,
      creator: {
        id: users.id,
        name: users.name,
        email: users.email
      }
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.creatorId, users.id))
    .where(eq(expenses.householdId, householdId))
    .orderBy(desc(expenses.createdAt))
    .limit(PAGE_SIZE);

  // Fetch all expense splits for these expenses
  const expenseIds = householdExpenses.map(({ expense }) => expense.id);
  const allExpenseSplits =
    expenseIds.length > 0
      ? await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
      : [];

  // Combine expenses with their splits
  const expensesWithSplits = householdExpenses.map(({ expense, creator }) => ({
    ...expense,
    creator,
    splits: allExpenseSplits.filter((split) => split.expenseId === expense.id)
  }));

  const currentUserId = locals.user.id;

  // Calculate balances between current user and all other members
  // This needs to look at ALL expenses, not just paginated ones
  // For each member: "owes you" = unpaid splits on expenses YOU created
  // For each member: "you owe" = unpaid splits on expenses THEY created (where you haven't paid)
  const memberBalances: Record<
    string,
    { owesYou: number; owesYouOptional: number; youOwe: number; youOweOptional: number }
  > = {};

  // Initialize balances for all members
  for (const member of members) {
    if (member.id !== currentUserId) {
      memberBalances[member.id] = { owesYou: 0, owesYouOptional: 0, youOwe: 0, youOweOptional: 0 };
    }
  }

  // Query: What others owe the current user (unpaid splits on current user's
  // expenses). Summed in SQL from the stored per-split amounts, so uneven
  // splits are respected and only one row per debtor crosses the wire.
  //
  // COALESCE covers any split written before per-split amounts existed: those
  // fall back to an even share of the expense.
  const owedToCurrentUser = await db
    .select({
      odebtor: expenseSplits.userId,
      isOptional: expenses.isOptional,
      total: sql<number>`SUM(COALESCE(
        ${expenseSplits.amount},
        ${expenses.amount} / (SELECT COUNT(*) FROM expense_splits WHERE expense_id = ${expenses.id})
      ))`
    })
    .from(expenses)
    .innerJoin(expenseSplits, eq(expenses.id, expenseSplits.expenseId))
    .where(
      and(
        eq(expenses.householdId, householdId),
        eq(expenses.creatorId, currentUserId),
        eq(expenseSplits.hasPaid, false),
        sql`${expenseSplits.userId} != ${currentUserId}`
      )
    )
    .groupBy(expenseSplits.userId, expenses.isOptional);

  for (const row of owedToCurrentUser) {
    const odebtor = row.odebtor;
    if (memberBalances[odebtor]) {
      if (row.isOptional) {
        memberBalances[odebtor].owesYouOptional += row.total;
      } else {
        memberBalances[odebtor].owesYou += row.total;
      }
    }
  }

  // Query: What the current user owes others, summed the same way
  const owedByCurrentUser = await db
    .select({
      creditor: expenses.creatorId,
      isOptional: expenses.isOptional,
      total: sql<number>`SUM(COALESCE(
        ${expenseSplits.amount},
        ${expenses.amount} / (SELECT COUNT(*) FROM expense_splits WHERE expense_id = ${expenses.id})
      ))`
    })
    .from(expenses)
    .innerJoin(expenseSplits, eq(expenses.id, expenseSplits.expenseId))
    .where(
      and(
        eq(expenses.householdId, householdId),
        eq(expenseSplits.userId, currentUserId),
        eq(expenseSplits.hasPaid, false),
        sql`${expenses.creatorId} != ${currentUserId}`
      )
    )
    .groupBy(expenses.creatorId, expenses.isOptional);

  for (const row of owedByCurrentUser) {
    const creditor = row.creditor;
    if (memberBalances[creditor]) {
      if (row.isOptional) {
        memberBalances[creditor].youOweOptional += row.total;
      } else {
        memberBalances[creditor].youOwe += row.total;
      }
    }
  }

  // Query for balance history chart data
  // We need all expenses and splits with dates to calculate running balances
  const balanceHistoryData = await db
    .select({
      expenseId: expenses.id,
      expenseCreatedAt: expenses.createdAt,
      expenseAmount: expenses.amount,
      creatorId: expenses.creatorId,
      isOptional: expenses.isOptional,
      splitUserId: expenseSplits.userId,
      splitAmount: expenseSplits.amount,
      hasPaid: expenseSplits.hasPaid,
      paidAt: expenseSplits.paidAt
    })
    .from(expenses)
    .innerJoin(expenseSplits, eq(expenses.id, expenseSplits.expenseId))
    .where(eq(expenses.householdId, householdId))
    .orderBy(expenses.createdAt);

  // Process into balance events
  type BalanceEvent = {
    date: Date;
    youOweChange: number;
    owedToYouChange: number;
    isOptional: boolean;
    description: string;
  };

  const balanceEvents: BalanceEvent[] = [];
  const processedExpenses = new Set<string>();

  for (const row of balanceHistoryData) {
    // The stored share, falling back to an even split only for rows written
    // before per-split amounts existed.
    const splitCount = balanceHistoryData.filter((r) => r.expenseId === row.expenseId).length;
    const share = row.splitAmount ?? (splitCount > 0 ? row.expenseAmount / splitCount : 0);

    // When expense is created: if I'm in the split (not creator), I owe money
    // If I'm the creator and others are in the split, they owe me
    if (!processedExpenses.has(row.expenseId + '_created')) {
      processedExpenses.add(row.expenseId + '_created');

      // Find all splits for this expense
      const expenseSplitsForThis = balanceHistoryData.filter((r) => r.expenseId === row.expenseId);
      const isMyExpense = row.creatorId === currentUserId;

      if (isMyExpense) {
        // Others owe me their shares. Each person's own amount, not this row's
        // share counted once per person: with uneven splits those differ.
        const othersOwedTotal = expenseSplitsForThis
          .filter((s) => s.splitUserId !== currentUserId)
          .reduce(
            (sum, s) =>
              sum + (s.splitAmount ?? (splitCount > 0 ? row.expenseAmount / splitCount : 0)),
            0
          );
        if (othersOwedTotal > 0) {
          balanceEvents.push({
            date: row.expenseCreatedAt,
            youOweChange: 0,
            owedToYouChange: othersOwedTotal,
            isOptional: row.isOptional,
            description: 'Expense created'
          });
        }
      } else {
        // Check if I'm in this split
        const myShare = expenseSplitsForThis.find((s) => s.splitUserId === currentUserId);
        if (myShare) {
          // My own share, not `share`: that comes from whichever row this loop
          // happens to be on, which may be another participant. With uneven
          // splits those differ, and the processedExpenses guard means the
          // first row seen is the only chance to get it right.
          const mine = myShare.splitAmount ?? (splitCount > 0 ? row.expenseAmount / splitCount : 0);
          balanceEvents.push({
            date: row.expenseCreatedAt,
            youOweChange: mine,
            owedToYouChange: 0,
            isOptional: row.isOptional,
            description: 'Expense created'
          });
        }
      }
    }

    // When a split is paid: reduce the balance
    if (row.hasPaid && row.paidAt) {
      const eventKey = row.expenseId + '_paid_' + row.splitUserId;
      if (!processedExpenses.has(eventKey)) {
        processedExpenses.add(eventKey);

        const isMyExpense = row.creatorId === currentUserId;
        const isMyPayment = row.splitUserId === currentUserId;

        if (isMyExpense && !isMyPayment) {
          // Someone paid me
          balanceEvents.push({
            date: row.paidAt,
            youOweChange: 0,
            owedToYouChange: -share,
            isOptional: row.isOptional,
            description: 'Payment received'
          });
        } else if (!isMyExpense && isMyPayment) {
          // I paid someone
          balanceEvents.push({
            date: row.paidAt,
            youOweChange: -share,
            owedToYouChange: 0,
            isOptional: row.isOptional,
            description: 'Payment made'
          });
        }
      }
    }
  }

  // Sort by date
  balanceEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Every expense the current user still owes on, independent of the paginated
  // list above. "Pay All Expenses" must reach expenses on later pages, and the
  // pay modal looks each selected id up in an array, so the rows have to be
  // present or the total silently undercounts.
  const owedRows = await db
    .select({
      expense: expenses,
      splitUserId: expenseSplits.userId,
      splitAmount: expenseSplits.amount,
      splitHasPaid: expenseSplits.hasPaid,
      splitPaidAt: expenseSplits.paidAt
    })
    .from(expenses)
    .innerJoin(expenseSplits, eq(expenses.id, expenseSplits.expenseId))
    .where(
      and(
        eq(expenses.householdId, householdId),
        sql`${expenses.creatorId} != ${currentUserId}`,
        // Restrict to expenses the user is actually part of and has not settled
        sql`EXISTS (
          SELECT 1 FROM expense_splits s
          WHERE s.expense_id = ${expenses.id}
            AND s.user_id = ${currentUserId}
            AND s.has_paid = 0
        )`
      )
    )
    .orderBy(desc(expenses.createdAt));

  const unpaidMap = new Map<
    string,
    {
      id: string;
      description: string;
      amount: number;
      isOptional: boolean;
      tagId: string | null;
      dueDate: string | null;
      creatorId: string;
      createdAt: Date;
      splits: { userId: string; amount: number | null; hasPaid: boolean; paidAt: Date | null }[];
    }
  >();

  for (const row of owedRows) {
    if (!unpaidMap.has(row.expense.id)) {
      unpaidMap.set(row.expense.id, {
        id: row.expense.id,
        description: row.expense.description,
        amount: row.expense.amount,
        isOptional: row.expense.isOptional,
        tagId: row.expense.tagId,
        // A due date only means something alongside a type. The FK sets tag_id
        // to null if a type is deleted outside the app, which would otherwise
        // leave the date stranded on an ordinary expense.
        dueDate: row.expense.tagId ? row.expense.dueDate : null,
        creatorId: row.expense.creatorId,
        createdAt: row.expense.createdAt,
        splits: []
      });
    }
    unpaidMap.get(row.expense.id)!.splits.push({
      userId: row.splitUserId,
      amount: row.splitAmount,
      hasPaid: row.splitHasPaid,
      paidAt: row.splitPaidAt
    });
  }

  const unpaidExpenses = Array.from(unpaidMap.values());

  // Query: Full reverse expense data for cancel-out in PayExpensesModal
  // Expenses created by current user where other members have unpaid splits
  const reverseExpenseRows = await db
    .select({
      expense: expenses,
      splitId: expenseSplits.id,
      splitUserId: expenseSplits.userId,
      splitAmount: expenseSplits.amount,
      splitHasPaid: expenseSplits.hasPaid,
      splitPaidAt: expenseSplits.paidAt
    })
    .from(expenses)
    .innerJoin(expenseSplits, eq(expenses.id, expenseSplits.expenseId))
    .where(and(eq(expenses.householdId, householdId), eq(expenses.creatorId, currentUserId)));

  // Filter to only expenses that have at least one unpaid split from a non-creator
  const reverseExpenseMap = new Map<
    string,
    {
      id: string;
      description: string;
      amount: number;
      isOptional: boolean;
      tagId: string | null;
      dueDate: string | null;
      creatorId: string;
      createdAt: Date;
      splits: { userId: string; amount: number | null; hasPaid: boolean; paidAt: Date | null }[];
    }
  >();

  for (const row of reverseExpenseRows) {
    if (!reverseExpenseMap.has(row.expense.id)) {
      reverseExpenseMap.set(row.expense.id, {
        id: row.expense.id,
        description: row.expense.description,
        amount: row.expense.amount,
        isOptional: row.expense.isOptional,
        tagId: row.expense.tagId,
        // A due date only means something alongside a type. The FK sets tag_id
        // to null if a type is deleted outside the app, which would otherwise
        // leave the date stranded on an ordinary expense.
        dueDate: row.expense.tagId ? row.expense.dueDate : null,
        creatorId: row.expense.creatorId,
        createdAt: row.expense.createdAt,
        splits: []
      });
    }
    reverseExpenseMap.get(row.expense.id)!.splits.push({
      userId: row.splitUserId,
      amount: row.splitAmount,
      hasPaid: row.splitHasPaid,
      paidAt: row.splitPaidAt
    });
  }

  // Only include expenses where at least one non-creator split is unpaid
  const reverseExpenses = Array.from(reverseExpenseMap.values()).filter((e) =>
    e.splits.some((s) => s.userId !== currentUserId && !s.hasPaid)
  );

  // Return the raw events so the client can filter by optional status
  const balanceHistory = balanceEvents.map((event) => ({
    date: event.date,
    youOweChange: event.youOweChange,
    owedToYouChange: event.owedToYouChange,
    isOptional: event.isOptional
  }));

  // Fetch recent nudges involving the current user (within 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentNudges = await db
    .select({
      id: nudgeHistory.id,
      fromUserId: nudgeHistory.fromUserId,
      toUserId: nudgeHistory.toUserId,
      customMessage: nudgeHistory.customMessage,
      createdAt: nudgeHistory.createdAt
    })
    .from(nudgeHistory)
    .where(
      and(eq(nudgeHistory.householdId, householdId), gt(nudgeHistory.createdAt, twentyFourHoursAgo))
    );

  // Separate into: nudges I sent, nudges I received
  const nudgesSent = recentNudges.filter((n) => n.fromUserId === currentUserId);
  const nudgesReceived = recentNudges.filter((n) => n.toUserId === currentUserId);

  // The household's important-expense types, for the create form, the grid
  // colours and the banners
  const tags = await db
    .select()
    .from(expenseTags)
    .where(eq(expenseTags.householdId, householdId))
    .orderBy(asc(expenseTags.sortOrder), asc(expenseTags.name));

  return {
    tags,
    expenses: expensesWithSplits,
    totalExpenses,
    hasMoreExpenses: totalExpenses > PAGE_SIZE,
    memberBalances,
    balanceHistory,
    nudgesSent,
    nudgesReceived,
    reverseExpenses,
    unpaidExpenses
  };
};

/**
 * Verify a submitted tag belongs to this household.
 *
 * Returns true for null (untagged, which is the common case). The foreign key
 * alone would only prove the tag exists somewhere.
 */
async function tagBelongsToHousehold(tagId: string | null, householdId: string) {
  if (tagId === null) return true;
  const rows = await db
    .select({ id: expenseTags.id })
    .from(expenseTags)
    .where(and(eq(expenseTags.id, tagId), eq(expenseTags.householdId, householdId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Validate a posted due date.
 *
 * Only meaningful on a high priority expense, so it is dropped when there is no
 * type. Date-only (YYYY-MM-DD) to match the column; anything else is rejected
 * rather than coerced, so a malformed value cannot reach the banner.
 */
function parseDueDate(raw: FormDataEntryValue | null, tagId: string | null): string | null {
  if (tagId === null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  // Reject impossible dates that match the shape, e.g. 2026-02-31
  const [y, m, d] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return trimmed;
}

export const actions: Actions = {
  createExpense: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;

    // Verify user is a member
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, locals.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    const formData = await request.formData();
    const amount = parseAmount(formData.get('amount'));
    const description = formData.get('description') as string;
    const isOptional = formData.get('isOptional') === 'on';
    // Any member may apply a tag. Only defining the vocabulary is admin-only:
    // whoever pays the rent is the one who needs to flag it as rent.
    // tagBelongsToHousehold below rejects a tag from another household.
    const tagId = (formData.get('tagId') as string) || null;
    const dueDate = parseDueDate(formData.get('dueDate'), tagId);
    const splitWith = formData.getAll('splitWith') as string[];

    // Validate input. parseAmount rejects Infinity, NaN and trailing junk,
    // which `!amount || amount <= 0` let through: an Infinity amount would
    // poison every balance SUM in the household.
    if (amount === null) {
      return fail(400, { error: 'Enter an amount between 0 and 1,000,000' });
    }
    if (!description || description.trim() === '') {
      return fail(400, { error: 'Description is required' });
    }
    if (!(await tagBelongsToHousehold(tagId, householdId))) {
      return fail(400, { error: 'Unknown tag' });
    }

    // Note: splitWith can be empty - creator is always included in the split

    const currentUserId = locals.user.id;

    // Per-person amounts posted by the split editor. Only the overridden ones
    // are trusted as intent: the rest are recalculated here so the stored
    // shares always sum to the expense, whatever the client sent.
    const postedIds = formData.getAll('splitUserIds') as string[];
    const postedAmounts = formData.getAll('splitAmounts') as string[];
    const posted = new Map<string, number>();
    postedIds.forEach((id, i) => {
      const value = parseFloat(postedAmounts[i]);
      if (Number.isFinite(value) && value >= 0) posted.set(id, value);
    });

    // Who the expense is divided between. The split editor posts one row per
    // participant, which is the authoritative list; splitWith is the older
    // shape and is still honoured so any caller that sends it keeps working.
    const requested = postedIds.length > 0 ? postedIds : splitWith;

    // Only real members of this household can be given a share, so a forged id
    // cannot attach someone else's account to an expense.
    const memberRows = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));
    const memberIds = new Set(memberRows.map((m) => m.userId));

    const allSplitUsers = [...new Set([currentUserId, ...requested])].filter((id) =>
      memberIds.has(id)
    );

    // An amount counts as an override only if it differs from the even share,
    // so an untouched form still divides evenly after any rounding.
    const evenShare = amount / allSplitUsers.length;
    const splitAmounts = calculateSplits(
      amount,
      allSplitUsers.map((userId) => {
        const p = posted.get(userId);
        const isOverride = p !== undefined && Math.abs(p - evenShare) > 0.005;
        return { userId, override: isOverride ? p : undefined };
      }),
      currentUserId
    );

    // Validate before writing anything. calculateSplits honours overrides as
    // given, so a client that pins every share could otherwise leave part of
    // the expense unaccounted for, and an early return after the expense row
    // was inserted would leave it orphaned with no splits.
    if (
      !splitsMatchTotal(
        amount,
        splitAmounts.map((sp) => sp.amount)
      )
    ) {
      return fail(400, {
        error: 'The split amounts must add up to the expense total'
      });
    }

    const amountByUser = new Map(splitAmounts.map((sp) => [sp.userId, sp.amount]));

    // Create expense. One transaction: an expense with no split rows owes
    // nothing to anyone and shows up for no one, but still counts toward the
    // household total, so it must never exist on its own.
    const expenseId = generateId();
    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        id: expenseId,
        householdId,
        creatorId: currentUserId,
        amount,
        description,
        isOptional,
        tagId,
        dueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await tx.insert(expenseSplits).values(
        allSplitUsers.map((userId) => ({
          id: generateId(),
          expenseId,
          userId,
          amount: amountByUser.get(userId) ?? 0,
          hasPaid: userId === currentUserId, // Creator has already paid
          paidAt: userId === currentUserId ? new Date() : null
        }))
      );
    });

    return { success: true };
  },

  inviteMember: async ({ request, locals, params, url }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;

    // Verify user is an admin and get household info
    const householdData = await db
      .select({
        householdName: households.name,
        role: householdMembers.role
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, locals.user.id)
        )
      )
      .limit(1);

    if (householdData.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    if (householdData[0].role !== 'admin') {
      throw error(403, 'Only admins can invite members');
    }

    const formData = await request.formData();
    const email = formData.get('email') as string;

    // Validate email
    if (!email || !email.includes('@')) {
      return fail(400, { error: 'Valid email address is required' });
    }

    // Check if user with this email already exists in the household
    const existingMember = await db
      .select()
      .from(users)
      .innerJoin(householdMembers, eq(users.id, householdMembers.userId))
      .where(and(eq(users.email, email), eq(householdMembers.householdId, householdId)))
      .limit(1);

    if (existingMember.length > 0) {
      return fail(400, { error: 'This user is already a member of this household' });
    }

    // Check if there's already an unused invite for this email
    const existingInvite = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.householdId, householdId),
          eq(invites.invitedEmail, email),
          eq(invites.used, false)
        )
      )
      .limit(1);

    if (existingInvite.length > 0) {
      return fail(400, { error: 'An invite has already been sent to this email' });
    }

    // Create invite
    const inviteId = generateId();
    const normalizedEmail = email.toLowerCase();
    await db.insert(invites).values({
      id: inviteId,
      householdId,
      invitedEmail: normalizedEmail,
      token: generateId(),
      createdBy: locals.user.id,
      used: false,
      createdAt: new Date()
    });

    // Generate signed URLs for the invite email
    const signature = await createInviteSignature(inviteId, normalizedEmail);
    const emailParam = encodeURIComponent(normalizedEmail);
    const signupLink = `${url.origin}/signup?email=${emailParam}&invite=${inviteId}&sig=${signature}`;
    const loginLink = `${url.origin}/login?email=${emailParam}`;

    // Send invite email
    const { html, text } = getHouseholdInviteEmail({
      householdName: householdData[0].householdName,
      inviterName: locals.user.name,
      signupLink,
      loginLink
    });

    const emailSent = await sendEmail({
      to: email.toLowerCase(),
      subject: `You're invited to join ${householdData[0].householdName} on RoomieSync`,
      html,
      text
    });

    if (!emailSent) {
      // Invite was created but email failed - return success with warning
      return { success: true, emailFailed: true };
    }

    return { success: true, emailSent: true };
  },

  cancelInvite: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;

    // Verify user is an admin
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, locals.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    if (membership[0].role !== 'admin') {
      throw error(403, 'Only admins can cancel invites');
    }

    const formData = await request.formData();
    const inviteId = formData.get('inviteId') as string;

    if (!inviteId) {
      return fail(400, { error: 'Invalid invite' });
    }

    // Delete the invite
    // Scope to this household, matching resendInvite: without it an admin of any
    // household could cancel an invite belonging to another one.
    const cancelled = await db
      .delete(invites)
      .where(and(eq(invites.id, inviteId), eq(invites.householdId, householdId)));

    if (cancelled.rowsAffected === 0) {
      return fail(404, { error: 'Invite not found' });
    }

    return { success: true };
  },

  resendInvite: async ({ request, locals, params, url }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;

    // Verify user is an admin and get household info
    const householdData = await db
      .select({
        householdName: households.name,
        role: householdMembers.role
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, locals.user.id)
        )
      )
      .limit(1);

    if (householdData.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    if (householdData[0].role !== 'admin') {
      throw error(403, 'Only admins can resend invites');
    }

    const formData = await request.formData();
    const inviteId = formData.get('inviteId') as string;

    if (!inviteId) {
      return fail(400, { error: 'Invalid invite' });
    }

    // Get the invite
    const invite = await db
      .select()
      .from(invites)
      .where(and(eq(invites.id, inviteId), eq(invites.householdId, householdId)))
      .limit(1);

    if (invite.length === 0) {
      return fail(400, { error: 'Invite not found' });
    }

    if (invite[0].used) {
      return fail(400, { error: 'This invite has already been used' });
    }

    // Generate signed URLs for the invite email
    const signature = await createInviteSignature(inviteId, invite[0].invitedEmail);
    const emailParam = encodeURIComponent(invite[0].invitedEmail);
    const signupLink = `${url.origin}/signup?email=${emailParam}&invite=${inviteId}&sig=${signature}`;
    const loginLink = `${url.origin}/login?email=${emailParam}`;

    // Send invite email
    const { html, text } = getHouseholdInviteEmail({
      householdName: householdData[0].householdName,
      inviterName: locals.user.name,
      signupLink,
      loginLink
    });

    const emailSent = await sendEmail({
      to: invite[0].invitedEmail,
      subject: `You're invited to join ${householdData[0].householdName} on RoomieSync`,
      html,
      text
    });

    if (!emailSent) {
      return fail(500, { error: 'Failed to send email. Please try again.' });
    }

    return { success: true, resent: true };
  },

  updateDisplayName: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;

    // Verify user is an admin
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, locals.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    if (membership[0].role !== 'admin') {
      throw error(403, 'Only admins can update member display names');
    }

    const formData = await request.formData();
    const memberId = formData.get('memberId') as string;
    const displayName = (formData.get('displayName') as string)?.trim() || null;

    if (!memberId) {
      return fail(400, { error: 'Member ID is required' });
    }

    // Verify target member exists in this household
    const targetMember = await db
      .select()
      .from(householdMembers)
      .where(
        and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, memberId))
      )
      .limit(1);

    if (targetMember.length === 0) {
      return fail(400, { error: 'Member not found in this household' });
    }

    // Update the display name
    await db
      .update(householdMembers)
      .set({ displayName })
      .where(
        and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, memberId))
      );

    return { success: true };
  },

  markExpensesPaid: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is a member
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    const formData = await request.formData();
    const expenseIds = formData.getAll('expenseIds') as string[];
    const cancelOutExpenseIds = formData.getAll('cancelOutExpenseIds') as string[];
    const cancelOutForUserIds = formData.getAll('cancelOutForUserId') as string[];

    if (!expenseIds || expenseIds.length === 0) {
      return fail(400, { error: 'No expenses selected' });
    }

    const now = new Date();

    // Mark user's selected expenses as paid
    await db
      .update(expenseSplits)
      .set({ hasPaid: true, paidAt: now })
      .where(
        and(inArray(expenseSplits.expenseId, expenseIds), eq(expenseSplits.userId, currentUserId))
      );

    // Handle cancel-out: mark reverse expenses as paid by the respective users
    if (
      cancelOutExpenseIds.length > 0 &&
      cancelOutExpenseIds.length === cancelOutForUserIds.length
    ) {
      // Group by userId for efficiency
      const cancelOutByUser = new Map<string, string[]>();
      for (let i = 0; i < cancelOutExpenseIds.length; i++) {
        const userId = cancelOutForUserIds[i];
        const expId = cancelOutExpenseIds[i];
        if (!cancelOutByUser.has(userId)) cancelOutByUser.set(userId, []);
        cancelOutByUser.get(userId)!.push(expId);
      }

      for (const [userId, expIds] of cancelOutByUser) {
        // Validate: these expenses must be created by the current user
        const validExpenses = await db
          .select({ id: expenses.id })
          .from(expenses)
          .where(
            and(
              inArray(expenses.id, expIds),
              eq(expenses.householdId, householdId),
              eq(expenses.creatorId, currentUserId)
            )
          );

        const validIds = validExpenses.map((e) => e.id);
        if (validIds.length > 0) {
          await db
            .update(expenseSplits)
            .set({ hasPaid: true, paidAt: now })
            .where(
              and(inArray(expenseSplits.expenseId, validIds), eq(expenseSplits.userId, userId))
            );
        }
      }
    }

    return { success: true };
  },

  editExpense: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is a member
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    const formData = await request.formData();
    const expenseId = formData.get('expenseId') as string;
    const description = formData.get('description') as string;
    const isOptional = formData.get('isOptional') === 'on';
    const postedTagId = (formData.get('tagId') as string) || null;
    const splitWith = formData.getAll('splitWith') as string[];
    // Per-person amounts from the split editor, same shape as createExpense.
    const postedIds = formData.getAll('splitUserIds') as string[];
    const postedAmounts = formData.getAll('splitAmounts') as string[];
    const posted = new Map<string, number>();
    postedIds.forEach((id, i) => {
      const value = parseFloat(postedAmounts[i]);
      if (Number.isFinite(value) && value >= 0) posted.set(id, value);
    });

    if (!expenseId) {
      return fail(400, { error: 'Expense ID is required' });
    }

    if (!description || description.trim() === '') {
      return fail(400, { error: 'Description is required' });
    }

    // Verify user is the creator of this expense
    const expense = await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.id, expenseId),
          eq(expenses.householdId, householdId),
          eq(expenses.creatorId, currentUserId)
        )
      )
      .limit(1);

    if (expense.length === 0) {
      return fail(403, { error: 'You can only edit expenses you created' });
    }

    // Any member may change the tag on an expense they created. A form that
    // posts no tagId at all keeps the existing tag rather than clearing it, so
    // an older form cannot silently untag the rent; clearing is done by posting
    // an empty value, which the modal always sends.
    const tagId = formData.has('tagId') ? postedTagId : expense[0].tagId;

    // Keyed off the resolved tagId, so clearing the type also clears the date.
    // An absent field keeps the stored value, matching how tagId behaves.
    const dueDate = formData.has('dueDate')
      ? parseDueDate(formData.get('dueDate'), tagId)
      : tagId === null
        ? null
        : expense[0].dueDate;

    if (!(await tagBelongsToHousehold(tagId, householdId))) {
      return fail(400, { error: 'Unknown tag' });
    }

    // Get current splits

    const currentSplits = await db
      .select()
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId));

    // Who the expense is divided between. The split editor posts one row per
    // participant; splitWith is the older shape and still works.
    const requested = postedIds.length > 0 ? postedIds : splitWith;

    // Only real members can be given a share, so a forged id cannot attach
    // someone else's account to the expense.
    const memberRows = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));
    const memberIds = new Set(memberRows.map((m) => m.userId));

    const newSplitUserIds = [...new Set([currentUserId, ...requested])].filter((id) =>
      memberIds.has(id)
    );
    const currentSplitUserIds = currentSplits.map((s) => s.userId);

    // Work out the new shares before touching anything. calculateSplits honours
    // overrides as given, so a client that pins every share could leave part of
    // the expense unaccounted for; failing after the membership writes would
    // leave the expense half edited.
    //
    // Posted amounts are honoured, so an uneven expense stays uneven through an
    // edit. An amount only counts as an override when it differs from the even
    // share, so an untouched form still divides evenly after any rounding.
    const evenShare = expense[0].amount / newSplitUserIds.length;
    const rebalanced = calculateSplits(
      expense[0].amount,
      newSplitUserIds.map((userId) => {
        const p = posted.get(userId);
        const isOverride = p !== undefined && Math.abs(p - evenShare) > 0.005;
        return { userId, override: isOverride ? p : undefined };
      }),
      expense[0].creatorId
    );

    if (
      !splitsMatchTotal(
        expense[0].amount,
        rebalanced.map((sp) => sp.amount)
      )
    ) {
      return fail(400, {
        error: 'The split amounts must add up to the expense total'
      });
    }

    const amountByUser = new Map(rebalanced.map((r) => [r.userId, r.amount]));

    // Find splits to add (new members not currently in splits)
    const splitsToAdd = newSplitUserIds.filter((id) => !currentSplitUserIds.includes(id));

    // Find splits to remove (current members no longer in splits, excluding creator)
    const splitsToRemove = currentSplits.filter(
      (s) => !newSplitUserIds.includes(s.userId) && s.userId !== currentUserId
    );
    const removedIds = new Set(splitsToRemove.map((s) => s.id));

    // The rows that survive this edit, so the amounts can be written without
    // re-reading what was just changed.
    const survivingSplits = currentSplits.filter((s) => !removedIds.has(s.id));

    // One transaction for the whole edit. Every write below depends on the
    // others: an expense whose membership changed but whose amounts did not no
    // longer sums to its total, and every balance is read straight from these
    // stored amounts, so a partial write is silently wrong money rather than a
    // visible error.
    await db.transaction(async (tx) => {
      // Only now that the split is known to reconcile: a rejected split used to
      // leave the description saved and the amounts untouched.
      await tx
        .update(expenses)
        .set({ description: description.trim(), isOptional, tagId, dueDate, updatedAt: new Date() })
        .where(eq(expenses.id, expenseId));

      if (splitsToAdd.length > 0) {
        await tx.insert(expenseSplits).values(
          splitsToAdd.map((userId) => ({
            id: generateId(),
            expenseId,
            userId,
            amount: amountByUser.get(userId) ?? 0,
            hasPaid: false,
            paidAt: null
          }))
        );
      }

      if (splitsToRemove.length > 0) {
        await tx.delete(expenseSplits).where(inArray(expenseSplits.id, [...removedIds]));
      }

      // Rewrite every surviving share, not just the changed ones: adding or
      // removing a person changes what everyone else owes.
      for (const sp of survivingSplits) {
        await tx
          .update(expenseSplits)
          .set({ amount: amountByUser.get(sp.userId) ?? 0 })
          .where(eq(expenseSplits.id, sp.id));
      }
    });

    return { success: true };
  },

  deleteExpense: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is a member
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    const formData = await request.formData();
    const expenseId = formData.get('expenseId') as string;

    if (!expenseId) {
      return fail(400, { error: 'Expense ID is required' });
    }

    // Verify user is the creator of this expense
    const expense = await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.id, expenseId),
          eq(expenses.householdId, householdId),
          eq(expenses.creatorId, currentUserId)
        )
      )
      .limit(1);

    if (expense.length === 0) {
      return fail(403, { error: 'You can only delete expenses you created' });
    }

    // One transaction: the splits going without the expense would leave a row
    // that counts toward the household total but owes nothing to anyone.
    await db.transaction(async (tx) => {
      // Splits first, for the foreign key constraint
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
      await tx.delete(expenses).where(eq(expenses.id, expenseId));
    });

    return { success: true };
  },

  importExpense: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;

    // Verify user is an admin
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, locals.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    if (membership[0].role !== 'admin') {
      throw error(403, 'Only admins can import expenses');
    }

    const formData = await request.formData();
    const creatorId = formData.get('creatorId') as string;
    const amount = parseAmount(formData.get('amount'));
    const description = formData.get('description') as string;
    const expenseDateStr = formData.get('expenseDate') as string;
    const isOptional = formData.get('isOptional') === 'on';
    const splitWith = formData.getAll('splitWith') as string[];
    const paidMembers = formData.getAll('paidMembers') as string[];

    // Get individual payment dates for each paid member
    const paidDates: Record<string, string> = {};
    for (const memberId of paidMembers) {
      const dateStr = formData.get(`paidDate_${memberId}`) as string;
      if (dateStr) {
        paidDates[memberId] = dateStr;
      }
    }

    // Validate input
    if (!creatorId) {
      return fail(400, { error: 'Creator is required' });
    }
    if (amount === null) {
      return fail(400, { error: 'Enter an amount between 0 and 1,000,000' });
    }
    if (!description || description.trim() === '') {
      return fail(400, { error: 'Description is required' });
    }
    if (!expenseDateStr) {
      return fail(400, { error: 'Date is required' });
    }

    // Parse expense date (set to noon to avoid timezone issues)
    const expenseDate = new Date(expenseDateStr + 'T12:00:00');
    if (isNaN(expenseDate.getTime())) {
      return fail(400, { error: 'Invalid date' });
    }

    // Verify creator is a member of the household
    const creatorMembership = await db
      .select()
      .from(householdMembers)
      .where(
        and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, creatorId))
      )
      .limit(1);

    if (creatorMembership.length === 0) {
      return fail(400, { error: 'Selected creator is not a member of this household' });
    }

    // Verify all split members are household members
    if (splitWith.length > 0) {
      const splitMemberships = await db
        .select()
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            inArray(householdMembers.userId, splitWith)
          )
        );

      if (splitMemberships.length !== splitWith.length) {
        return fail(400, { error: 'One or more split members are not in this household' });
      }
    }

    // Create expense
    const expenseId = generateId();
    const now = new Date();

    // Create expense splits for selected members + creator
    const allSplitUsers = [...new Set([creatorId, ...splitWith])];

    // Default paidAt date for members without a specific date:
    // 24 hours after expense date, or current time if that would be in the future
    const twentyFourHoursLater = new Date(expenseDate.getTime() + 24 * 60 * 60 * 1000);
    const defaultPaidAtDate = twentyFourHoursLater > now ? now : twentyFourHoursLater;

    // Helper to get paidAt date for a member
    const getPaidAtDate = (userId: string): Date | null => {
      if (userId === creatorId) {
        return expenseDate;
      }
      if (paidMembers.includes(userId)) {
        const memberDateStr = paidDates[userId];
        if (memberDateStr) {
          const memberDate = new Date(memberDateStr + 'T12:00:00');
          if (!isNaN(memberDate.getTime())) {
            return memberDate;
          }
        }
        return defaultPaidAtDate;
      }
      return null;
    };

    // Amounts are stored, not derived, so an imported expense must set them
    // too. Leaving them null would feed the legacy even-share fallback with
    // brand new rows and block making the column NOT NULL later.
    const importedSplits = calculateSplits(
      amount,
      allSplitUsers.map((userId) => ({ userId })),
      creatorId
    );
    const importedByUser = new Map(importedSplits.map((sp) => [sp.userId, sp.amount]));

    // One transaction, as in createExpense: an expense with no split rows
    // counts toward the household total while owing nothing to anyone.
    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        id: expenseId,
        householdId,
        creatorId,
        amount,
        description: description.trim(),
        isOptional,
        createdAt: expenseDate,
        updatedAt: now
      });

      await tx.insert(expenseSplits).values(
        allSplitUsers.map((userId) => ({
          id: generateId(),
          expenseId,
          userId,
          amount: importedByUser.get(userId) ?? 0,
          hasPaid: userId === creatorId || paidMembers.includes(userId),
          paidAt: getPaidAtDate(userId)
        }))
      );
    });

    return { success: true };
  },

  cancelPayment: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is a member
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    const formData = await request.formData();
    const expenseId = formData.get('expenseId') as string;

    if (!expenseId) {
      return fail(400, { error: 'Expense ID is required' });
    }

    // Verify the expense exists and user has a paid split for it
    const split = await db
      .select()
      .from(expenseSplits)
      .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
      .where(
        and(
          eq(expenseSplits.expenseId, expenseId),
          eq(expenseSplits.userId, currentUserId),
          eq(expenses.householdId, householdId),
          eq(expenseSplits.hasPaid, true)
        )
      )
      .limit(1);

    if (split.length === 0) {
      return fail(400, { error: 'No paid split found for this expense' });
    }

    // Don't allow canceling if you're the expense creator
    if (split[0].expenses.creatorId === currentUserId) {
      return fail(400, { error: 'Cannot cancel payment on your own expense' });
    }

    // Update expense split to mark as unpaid
    await db
      .update(expenseSplits)
      .set({ hasPaid: false, paidAt: null })
      .where(and(eq(expenseSplits.expenseId, expenseId), eq(expenseSplits.userId, currentUserId)));

    return { success: true };
  },

  sendNudge: async ({ request, locals, params, url }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is a member and get household name
    const householdData = await db
      .select({
        householdName: households.name,
        member: householdMembers
      })
      .from(householdMembers)
      .innerJoin(households, eq(households.id, householdMembers.householdId))
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId)
        )
      )
      .limit(1);

    if (householdData.length === 0) {
      throw error(403, 'You are not a member of this household');
    }

    const formData = await request.formData();
    const toUserId = formData.get('toUserId') as string;
    const customMessage = (formData.get('customMessage') as string)?.trim() || null;
    // Display only, but a NaN or Infinity here would be emailed to someone
    const amountOwed = parseAmount(formData.get('amountOwed')) ?? 0;

    if (!toUserId) {
      return fail(400, { error: 'Recipient is required' });
    }

    // Verify recipient is a member and get their info
    const recipientMember = await db
      .select({
        userId: householdMembers.userId,
        userName: users.name,
        userEmail: users.email
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(
        and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, toUserId))
      )
      .limit(1);

    if (recipientMember.length === 0) {
      return fail(400, { error: 'Recipient is not a member of this household' });
    }

    // Check 24-hour rate limit
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentNudge = await db
      .select()
      .from(nudgeHistory)
      .where(
        and(
          eq(nudgeHistory.householdId, householdId),
          eq(nudgeHistory.fromUserId, currentUserId),
          eq(nudgeHistory.toUserId, toUserId),
          gt(nudgeHistory.createdAt, twentyFourHoursAgo)
        )
      )
      .limit(1);

    if (recentNudge.length > 0) {
      const hoursRemaining = Math.ceil(
        (recentNudge[0].createdAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)
      );
      return fail(429, { error: `Please wait ${hoursRemaining} hours before nudging again` });
    }

    // Insert nudge record
    await db.insert(nudgeHistory).values({
      id: generateId(),
      householdId,
      fromUserId: currentUserId,
      toUserId,
      customMessage,
      createdAt: new Date()
    });

    // Send email notification
    const { html, text } = getNudgeReminderEmail({
      recipientName: recipientMember[0].userName,
      senderName: locals.user.name,
      householdName: householdData[0].householdName,
      amountOwed,
      customMessage: customMessage || undefined,
      householdLink: `${url.origin}/household/${householdId}`
    });

    await sendEmail({
      to: recipientMember[0].userEmail,
      subject: `${locals.user.name} sent you a reminder in ${householdData[0].householdName}`,
      html,
      text
    });

    return { success: true, nudgeSent: true };
  },

  kickMember: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is admin
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId),
          eq(householdMembers.role, 'admin')
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'Only admins can remove members');
    }

    const formData = await request.formData();
    const memberId = formData.get('memberId') as string;

    if (!memberId) {
      return fail(400, { error: 'Member ID is required' });
    }

    if (memberId === currentUserId) {
      return fail(400, { error: 'You cannot remove yourself' });
    }

    // Verify target member exists in this household
    const targetMember = await db
      .select()
      .from(householdMembers)
      .where(
        and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, memberId))
      )
      .limit(1);

    if (targetMember.length === 0) {
      return fail(400, { error: 'Member not found in this household' });
    }

    // Delete their expense splits in this household
    const memberExpenseSplits = await db
      .select({ expenseId: expenseSplits.expenseId })
      .from(expenseSplits)
      .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
      .where(and(eq(expenses.householdId, householdId), eq(expenseSplits.userId, memberId)));

    if (memberExpenseSplits.length > 0) {
      const splitExpenseIds = memberExpenseSplits.map((s) => s.expenseId);
      await db
        .delete(expenseSplits)
        .where(
          and(inArray(expenseSplits.expenseId, splitExpenseIds), eq(expenseSplits.userId, memberId))
        );
    }

    // Delete expenses they created in this household (cascades to splits)
    await db
      .delete(expenses)
      .where(and(eq(expenses.householdId, householdId), eq(expenses.creatorId, memberId)));

    // Remove from household
    await db
      .delete(householdMembers)
      .where(
        and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, memberId))
      );

    return { success: true };
  },

  renameHousehold: async ({ request, locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is admin
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId),
          eq(householdMembers.role, 'admin')
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'Only admins can rename the household');
    }

    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();

    if (!name || name.length === 0) {
      return fail(400, { error: 'Name is required' });
    }

    if (name.length > 100) {
      return fail(400, { error: 'Name must be 100 characters or less' });
    }

    await db
      .update(households)
      .set({ name, updatedAt: new Date() })
      .where(eq(households.id, householdId));

    return { success: true };
  },

  createTag: async ({ request, locals, params }) => {
    const householdId = params.id;
    // Admin only, like the rest of tag management: a tag is a household-wide
    // label that changes how every member sees an expense, so who defines the
    // vocabulary is an admin decision.
    await requireAdmin(locals, householdId, 'manage expense tags');

    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || null;

    if (!name) {
      return fail(400, { error: 'Tag name is required' });
    }

    const existing = await db
      .select({ id: expenseTags.id })
      .from(expenseTags)
      .where(
        and(
          eq(expenseTags.householdId, householdId),
          sql`lower(${expenseTags.name}) = lower(${name})`
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return fail(400, { error: 'That tag already exists' });
    }

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${expenseTags.sortOrder}), -1)` })
      .from(expenseTags)
      .where(eq(expenseTags.householdId, householdId));

    await db.insert(expenseTags).values({
      id: generateId(),
      householdId,
      name,
      color,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
      createdAt: new Date()
    });

    return { success: true };
  },

  updateTag: async ({ request, locals, params }) => {
    const householdId = params.id;
    // Admin only: renaming a tag renames it for everyone who can see it.
    await requireAdmin(locals, householdId, 'manage expense tags');

    const formData = await request.formData();
    const tagId = formData.get('tagId') as string;
    const name = (formData.get('name') as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || null;

    if (!tagId || !name) {
      return fail(400, { error: 'Tag name is required' });
    }

    const clash = await db
      .select({ id: expenseTags.id })
      .from(expenseTags)
      .where(
        and(
          eq(expenseTags.householdId, householdId),
          ne(expenseTags.id, tagId),
          sql`lower(${expenseTags.name}) = lower(${name})`
        )
      )
      .limit(1);

    if (clash.length > 0) {
      return fail(400, { error: 'That tag already exists' });
    }

    const result = await db
      .update(expenseTags)
      .set({ name, color })
      .where(and(eq(expenseTags.id, tagId), eq(expenseTags.householdId, householdId)));

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Tag not found' });
    }

    return { success: true };
  },

  deleteTag: async ({ request, locals, params }) => {
    const householdId = params.id;
    // Untags every expense that used it, and leaves no record of what the tag
    // was afterwards.
    await requireAdmin(locals, householdId, 'manage expense tags');

    const formData = await request.formData();
    const tagId = formData.get('tagId') as string;

    if (!tagId) {
      return fail(400, { error: 'Tag is required' });
    }

    // Untag the expenses first, then remove the type, in one transaction so an
    // expense can never point at a type that no longer exists. The due date
    // goes with it: a date is only meaningful on a high priority expense.
    //
    // A missing type throws so the untag rolls back. Returning the 404 after
    // the transaction committed would report "not found" having already
    // written, which is exactly the protection the transaction is here for.
    const NOT_FOUND = 'tag-not-found';
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(expenses)
          .set({ tagId: null, dueDate: null, updatedAt: new Date() })
          .where(and(eq(expenses.householdId, householdId), eq(expenses.tagId, tagId)));

        const result = await tx
          .delete(expenseTags)
          .where(and(eq(expenseTags.id, tagId), eq(expenseTags.householdId, householdId)));

        if (result.rowsAffected === 0) throw new Error(NOT_FOUND);
      });
    } catch (err) {
      if (err instanceof Error && err.message === NOT_FOUND) {
        return fail(404, { error: 'Type not found' });
      }
      throw err;
    }

    return { success: true };
  },

  /**
   * Set or clear the household info card.
   *
   * Plain text: the client renders it with white-space: pre-wrap so line breaks
   * survive, and never as markup, so nothing an admin types can inject.
   */
  setHouseholdInfo: async ({ request, locals, params }) => {
    const householdId = params.id;
    await requireAdmin(locals, householdId, 'edit the household info');

    const formData = await request.formData();
    const raw = (formData.get('info') as string) ?? '';
    const info = raw.trim();

    if (info.length > 5000) {
      return fail(400, { error: 'Household info must be 5000 characters or less' });
    }

    // Empty clears it, which hides the card again rather than leaving a blank one
    await db
      .update(households)
      .set({
        info: info.length > 0 ? info : null,
        infoUpdatedAt: info.length > 0 ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(households.id, householdId));

    return { success: true };
  },

  /**
   * Archive or restore the household.
   *
   * A softer option than deletion, which was previously the only way for an
   * admin to retire a household. Archiving only moves it out of the homepage's
   * main list: expenses, shopping and every action keep working, and any admin
   * can restore it.
   */
  setArchived: async ({ request, locals, params }) => {
    const householdId = params.id;
    const { user } = await requireAdmin(locals, householdId, 'archive the household');

    const formData = await request.formData();
    const archived = formData.get('archived') === 'true';

    await db
      .update(households)
      .set({
        archivedAt: archived ? new Date() : null,
        archivedBy: archived ? user.id : null,
        updatedAt: new Date()
      })
      .where(eq(households.id, householdId));

    return { success: true };
  },

  deleteHousehold: async ({ locals, params }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const householdId = params.id;
    const currentUserId = locals.user.id;

    // Verify user is admin
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, currentUserId),
          eq(householdMembers.role, 'admin')
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw error(403, 'Only admins can delete the household');
    }

    // Delete household (cascades to members, expenses, splits, invites via foreign keys)
    await db.delete(households).where(eq(households.id, householdId));

    throw redirect(302, '/');
  }
};
