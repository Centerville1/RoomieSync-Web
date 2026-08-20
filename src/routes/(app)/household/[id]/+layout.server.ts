import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { households, householdMembers, users, invites, shoppingItems } from '$lib/server/db/schema';
import { eq, and, isNull, or, count } from 'drizzle-orm';

/**
 * Shared household context for every tab (expenses, shopping, ...).
 *
 * Only data the tab bar and household header need lives here. Tab-specific
 * data (expenses, balances, shopping items) stays in each page's own loader so
 * switching tabs doesn't pay for the other tab's queries.
 */
export const load: LayoutServerLoad = async ({ locals, params }) => {
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

  // Pending invites for the invite modal (rendered from the layout so it is
  // reachable from any tab)
  const pendingInvites = await db
    .select({
      id: invites.id,
      invitedEmail: invites.invitedEmail,
      createdAt: invites.createdAt
    })
    .from(invites)
    .where(and(eq(invites.householdId, householdId), eq(invites.used, false)));

  // Open shopping items for the tab badge: shared items plus the current
  // user's own personal ones. Counts what this user still has to buy.
  const openItemsResult = await db
    .select({ count: count() })
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, householdId),
        isNull(shoppingItems.purchasedAt),
        or(eq(shoppingItems.visibility, 'shared'), eq(shoppingItems.addedBy, locals.user.id))
      )
    );

  return {
    household: householdData[0].household,
    pendingInvites,
    openShoppingItems: openItemsResult[0]?.count ?? 0,
    userRole: householdData[0].member.role,
    currentUserId: locals.user.id,
    userName: locals.user.name,
    members
  };
};
