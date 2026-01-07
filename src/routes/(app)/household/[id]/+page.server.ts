import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/client';
import {
  households,
  householdMembers,
  users,
  expenses,
  expenseSplits,
  invites
} from '$lib/server/db/schema';
import { eq, and, desc, inArray, count, sql } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';
import { sendEmail } from '$lib/server/email';
import { getHouseholdInviteEmail } from '$lib/server/email/templates';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const householdId = params.id;

  // Fetch household and verify user is a member
  const householdData = await db
    .select({
      household: households,
      member: householdMembers
    })
    .from(households)
    .innerJoin(householdMembers, eq(households.id, householdMembers.householdId))
    .where(and(eq(households.id, householdId), eq(householdMembers.userId, locals.user.id)))
    .limit(1);

  if (householdData.length === 0) {
    throw error(404, 'Household not found or you do not have access');
  }

  // Fetch all members of the household
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      role: householdMembers.role,
      displayName: householdMembers.displayName,
      joinedAt: householdMembers.joinedAt
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId));

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

  // Fetch pending invites for this household (for admins)
  const pendingInvites = await db
    .select({
      id: invites.id,
      invitedEmail: invites.invitedEmail,
      createdAt: invites.createdAt
    })
    .from(invites)
    .where(and(eq(invites.householdId, householdId), eq(invites.used, false)));

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

  // Query: What others owe the current user (unpaid splits on current user's expenses)
  const owedToCurrentUser = await db
    .select({
      odebtor: expenseSplits.userId,
      amount: expenses.amount,
      isOptional: expenses.isOptional,
      splitCount: sql<number>`(SELECT COUNT(*) FROM expense_splits WHERE expense_id = ${expenses.id})`
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
    );

  for (const row of owedToCurrentUser) {
    const odebtor = row.odebtor;
    if (memberBalances[odebtor]) {
      const share = row.amount / row.splitCount;
      if (row.isOptional) {
        memberBalances[odebtor].owesYouOptional += share;
      } else {
        memberBalances[odebtor].owesYou += share;
      }
    }
  }

  // Query: What current user owes others (unpaid splits where current user hasn't paid)
  const owedByCurrentUser = await db
    .select({
      creditor: expenses.creatorId,
      amount: expenses.amount,
      isOptional: expenses.isOptional,
      splitCount: sql<number>`(SELECT COUNT(*) FROM expense_splits WHERE expense_id = ${expenses.id})`
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
    );

  for (const row of owedByCurrentUser) {
    const creditor = row.creditor;
    if (memberBalances[creditor]) {
      const share = row.amount / row.splitCount;
      if (row.isOptional) {
        memberBalances[creditor].youOweOptional += share;
      } else {
        memberBalances[creditor].youOwe += share;
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
    const splitCount = balanceHistoryData.filter((r) => r.expenseId === row.expenseId).length;
    const share = row.expenseAmount / splitCount;

    // When expense is created: if I'm in the split (not creator), I owe money
    // If I'm the creator and others are in the split, they owe me
    if (!processedExpenses.has(row.expenseId + '_created')) {
      processedExpenses.add(row.expenseId + '_created');

      // Find all splits for this expense
      const expenseSplitsForThis = balanceHistoryData.filter((r) => r.expenseId === row.expenseId);
      const isMyExpense = row.creatorId === currentUserId;

      if (isMyExpense) {
        // Others owe me their shares
        const othersOwedTotal = expenseSplitsForThis
          .filter((s) => s.splitUserId !== currentUserId)
          .reduce((sum) => sum + share, 0);
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
          balanceEvents.push({
            date: row.expenseCreatedAt,
            youOweChange: share,
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

  // Return the raw events so the client can filter by optional status
  const balanceHistory = balanceEvents.map((event) => ({
    date: event.date,
    youOweChange: event.youOweChange,
    owedToYouChange: event.owedToYouChange,
    isOptional: event.isOptional
  }));

  return {
    household: householdData[0].household,
    userRole: householdData[0].member.role,
    currentUserId,
    userName: locals.user.name,
    members,
    expenses: expensesWithSplits,
    totalExpenses,
    hasMoreExpenses: totalExpenses > PAGE_SIZE,
    pendingInvites,
    memberBalances,
    balanceHistory
  };
};

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
    const amount = parseFloat(formData.get('amount') as string);
    const description = formData.get('description') as string;
    const isOptional = formData.get('isOptional') === 'on';
    const splitWith = formData.getAll('splitWith') as string[];

    // Validate input
    if (!amount || amount <= 0) {
      return fail(400, { error: 'Amount must be greater than 0' });
    }
    if (!description || description.trim() === '') {
      return fail(400, { error: 'Description is required' });
    }
    // Note: splitWith can be empty - creator is always included in the split

    // Create expense
    const expenseId = generateId();
    const currentUserId = locals.user.id;
    await db.insert(expenses).values({
      id: expenseId,
      householdId,
      creatorId: currentUserId,
      amount,
      description,
      isOptional,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create expense splits for selected members + creator
    // Include the creator in the splits (marked as already paid)
    const allSplitUsers = [...new Set([currentUserId, ...splitWith])];

    const splits = allSplitUsers.map((userId) => ({
      id: generateId(),
      expenseId,
      userId,
      hasPaid: userId === currentUserId, // Creator has already paid
      paidAt: userId === currentUserId ? new Date() : null
    }));

    await db.insert(expenseSplits).values(splits);

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
    await db.insert(invites).values({
      id: generateId(),
      householdId,
      invitedEmail: email.toLowerCase(),
      token: generateId(),
      createdBy: locals.user.id,
      used: false,
      createdAt: new Date()
    });

    // Send invite email
    const { html, text } = getHouseholdInviteEmail({
      householdName: householdData[0].householdName,
      inviterName: locals.user.name,
      signupLink: `${url.origin}/signup`,
      loginLink: `${url.origin}/login`
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
    await db.delete(invites).where(eq(invites.id, inviteId));

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

    // Send invite email
    const { html, text } = getHouseholdInviteEmail({
      householdName: householdData[0].householdName,
      inviterName: locals.user.name,
      signupLink: `${url.origin}/signup`,
      loginLink: `${url.origin}/login`
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

    if (!expenseIds || expenseIds.length === 0) {
      return fail(400, { error: 'No expenses selected' });
    }

    // Update expense splits for current user
    await db
      .update(expenseSplits)
      .set({ hasPaid: true, paidAt: new Date() })
      .where(
        and(inArray(expenseSplits.expenseId, expenseIds), eq(expenseSplits.userId, currentUserId))
      );

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
    const splitWith = formData.getAll('splitWith') as string[];

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

    // Update the expense description and optional status
    await db
      .update(expenses)
      .set({ description: description.trim(), isOptional, updatedAt: new Date() })
      .where(eq(expenses.id, expenseId));

    // Handle split changes if splitWith was provided
    // Get current splits
    const currentSplits = await db
      .select()
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId));

    // The new split list should include the creator + selected members
    const newSplitUserIds = [...new Set([currentUserId, ...splitWith])];
    const currentSplitUserIds = currentSplits.map((s) => s.userId);

    // Find splits to add (new members not currently in splits)
    const splitsToAdd = newSplitUserIds.filter((id) => !currentSplitUserIds.includes(id));

    // Find splits to remove (current members no longer in splits, excluding creator)
    const splitsToRemove = currentSplits.filter(
      (s) => !newSplitUserIds.includes(s.userId) && s.userId !== currentUserId
    );

    // Add new splits
    if (splitsToAdd.length > 0) {
      const newSplits = splitsToAdd.map((userId) => ({
        id: generateId(),
        expenseId,
        userId,
        hasPaid: false,
        paidAt: null
      }));
      await db.insert(expenseSplits).values(newSplits);
    }

    // Remove old splits
    if (splitsToRemove.length > 0) {
      const idsToRemove = splitsToRemove.map((s) => s.id);
      await db.delete(expenseSplits).where(inArray(expenseSplits.id, idsToRemove));
    }

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

    // Delete expense splits first (foreign key constraint)
    await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));

    // Delete the expense
    await db.delete(expenses).where(eq(expenses.id, expenseId));

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
    const amount = parseFloat(formData.get('amount') as string);
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
    if (!amount || amount <= 0) {
      return fail(400, { error: 'Amount must be greater than 0' });
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

    await db.insert(expenses).values({
      id: expenseId,
      householdId,
      creatorId,
      amount,
      description: description.trim(),
      isOptional,
      createdAt: expenseDate,
      updatedAt: now
    });

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

    const splits = allSplitUsers.map((userId) => ({
      id: generateId(),
      expenseId,
      userId,
      hasPaid: userId === creatorId || paidMembers.includes(userId),
      paidAt: getPaidAtDate(userId)
    }));

    await db.insert(expenseSplits).values(splits);

    return { success: true };
  }
};
