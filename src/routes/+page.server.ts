import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { households, householdMembers, invites } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { households: [], pendingInvites: [] };
  }

  // Fetch user's households
  const userHouseholds = await db
    .select({
      id: households.id,
      name: households.name,
      imageUrl: households.imageUrl,
      bannerUrl: households.bannerUrl,
      primaryColor: households.primaryColor,
      secondaryColor: households.secondaryColor,
      createdAt: households.createdAt,
      role: householdMembers.role
    })
    .from(households)
    .innerJoin(householdMembers, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, locals.user.id));

  // Fetch pending invites for user's email
  const pendingInvites = await db
    .select({
      id: invites.id,
      householdId: invites.householdId,
      householdName: households.name,
      householdImageUrl: households.imageUrl,
      createdAt: invites.createdAt
    })
    .from(invites)
    .innerJoin(households, eq(invites.householdId, households.id))
    .where(and(eq(invites.invitedEmail, locals.user.email), eq(invites.used, false)));

  return {
    households: userHouseholds,
    pendingInvites
  };
};

export const actions: Actions = {
  createHousehold: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const formData = await request.formData();
    const name = formData.get('name');

    // Validation
    if (typeof name !== 'string' || !name || name.trim().length < 1) {
      return fail(400, {
        error: 'Household name is required'
      });
    }

    if (name.trim().length > 100) {
      return fail(400, {
        error: 'Household name must be less than 100 characters'
      });
    }

    const now = new Date();
    const householdId = generateId();
    const memberId = generateId();

    try {
      // Create household
      await db.insert(households).values({
        id: householdId,
        name: name.trim(),
        creatorId: locals.user.id,
        createdAt: now,
        updatedAt: now
      });

      // Add creator as admin member
      await db.insert(householdMembers).values({
        id: memberId,
        householdId,
        userId: locals.user.id,
        role: 'admin',
        joinedAt: now
      });

      // Redirect to the new household page
      throw redirect(302, `/household/${householdId}`);
    } catch (error) {
      console.error('Error creating household:', error);
      return fail(500, {
        error: 'Failed to create household. Please try again.'
      });
    }
  },

  acceptInvite: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const formData = await request.formData();
    const inviteId = formData.get('inviteId') as string;

    if (!inviteId) {
      return fail(400, { error: 'Invalid invite' });
    }

    // Fetch the invite
    const invite = await db
      .select()
      .from(invites)
      .where(and(eq(invites.id, inviteId), eq(invites.invitedEmail, locals.user.email)))
      .limit(1);

    if (invite.length === 0) {
      return fail(404, { error: 'Invite not found' });
    }

    if (invite[0].used) {
      return fail(400, { error: 'This invite has already been used' });
    }

    const householdId = invite[0].householdId;

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, locals.user.id)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return fail(400, { error: 'You are already a member of this household' });
    }

    // Add user to household
    await db.insert(householdMembers).values({
      id: generateId(),
      householdId,
      userId: locals.user.id,
      role: 'member',
      joinedAt: new Date()
    });

    // Mark invite as used
    await db
      .update(invites)
      .set({ used: true, usedAt: new Date() })
      .where(eq(invites.id, inviteId));

    // Redirect to the household
    throw redirect(302, `/household/${householdId}`);
  },

  declineInvite: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const formData = await request.formData();
    const inviteId = formData.get('inviteId') as string;

    if (!inviteId) {
      return fail(400, { error: 'Invalid invite' });
    }

    // Verify invite belongs to user
    const invite = await db
      .select()
      .from(invites)
      .where(and(eq(invites.id, inviteId), eq(invites.invitedEmail, locals.user.email)))
      .limit(1);

    if (invite.length === 0) {
      return fail(404, { error: 'Invite not found' });
    }

    // Mark invite as used (declined)
    await db
      .update(invites)
      .set({ used: true, usedAt: new Date() })
      .where(eq(invites.id, inviteId));

    return { success: true };
  }
};
