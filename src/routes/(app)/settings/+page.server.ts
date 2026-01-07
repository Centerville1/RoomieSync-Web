import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { users, sessions, householdMembers, expenseSplits, expenses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  return {
    user: {
      name: locals.user.name,
      email: locals.user.email
    }
  };
};

export const actions: Actions = {
  updateName: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const formData = await request.formData();
    const name = formData.get('name');

    if (typeof name !== 'string' || !name || name.length < 2) {
      return fail(400, {
        error: 'Name must be at least 2 characters',
        action: 'updateName'
      });
    }

    if (name.length > 100) {
      return fail(400, {
        error: 'Name must be less than 100 characters',
        action: 'updateName'
      });
    }

    await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, locals.user.id));

    return { success: true, action: 'updateName', message: 'Name updated successfully' };
  },

  deleteAccount: async ({ locals, cookies }) => {
    if (!locals.user) {
      throw redirect(302, '/login');
    }

    const userId = locals.user.id;

    // Delete in order to handle foreign key constraints:
    // 1. Delete expense splits where user is involved
    await db.delete(expenseSplits).where(eq(expenseSplits.userId, userId));

    // 2. Delete expenses created by user
    await db.delete(expenses).where(eq(expenses.creatorId, userId));

    // 3. Delete household memberships
    await db.delete(householdMembers).where(eq(householdMembers.userId, userId));

    // 4. Delete all sessions
    await db.delete(sessions).where(eq(sessions.userId, userId));

    // 5. Delete the user (this will cascade delete other related records)
    await db.delete(users).where(eq(users.id, userId));

    // Clear the session cookie
    cookies.set('session', '', {
      path: '/',
      expires: new Date(0)
    });

    throw redirect(302, '/');
  }
};
