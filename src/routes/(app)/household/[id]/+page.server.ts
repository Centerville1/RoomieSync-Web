import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { households, householdMembers, users } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

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
      joinedAt: householdMembers.joinedAt
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId));

  return {
    household: householdData[0].household,
    userRole: householdData[0].member.role,
    members
  };
};
