import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import {
  households,
  householdMembers,
  users,
  expenses,
  expenseSplits
} from '$lib/server/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  const householdId = params.id;
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

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

  // Fetch expenses with pagination
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
    .limit(PAGE_SIZE)
    .offset(offset);

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

  return json({
    expenses: expensesWithSplits,
    hasMore: householdExpenses.length === PAGE_SIZE
  });
};
