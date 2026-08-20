import { error, redirect } from '@sveltejs/kit';
import { db } from './db/client';
import { householdMembers } from './db/schema';
import { eq, and } from 'drizzle-orm';

type Locals = { user: { id: string; name: string } | null };

/**
 * Verify the logged-in user belongs to a household.
 *
 * Redirects to /login when there is no session and throws 403 when the user
 * is not a member. Returns the membership row so callers can read the role.
 */
export async function requireMembership(locals: Locals, householdId: string) {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

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

  return { membership: membership[0], user: locals.user };
}

/**
 * Same as requireMembership, but also requires the admin role.
 *
 * `action` is used in the error message, e.g. 'manage categories' produces
 * "Only admins can manage categories".
 */
export async function requireAdmin(locals: Locals, householdId: string, action: string) {
  const result = await requireMembership(locals, householdId);

  if (result.membership.role !== 'admin') {
    throw error(403, `Only admins can ${action}`);
  }

  return result;
}
