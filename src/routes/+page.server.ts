import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { households, householdMembers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { households: [] };
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

  return {
    households: userHouseholds
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
  }
};
