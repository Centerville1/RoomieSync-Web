import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import {
  users,
  sessions,
  householdMembers,
  expenseSplits,
  expenses,
  paymentMethods
} from '$lib/server/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';
import { providerById, normalizeHandle } from '$lib/payment-methods';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const methods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, locals.user.id))
    // Preferred first, then oldest, so the list does not reshuffle on edit
    .orderBy(desc(paymentMethods.isPreferred), asc(paymentMethods.createdAt));

  return {
    user: {
      name: locals.user.name,
      email: locals.user.email
    },
    paymentMethods: methods
  };
};

/** At most one preferred row per user, enforced here rather than in SQL. */
async function clearOtherPreferred(userId: string, keepId: string) {
  const rows = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isPreferred, true)));
  for (const row of rows) {
    if (row.id !== keepId) {
      await db
        .update(paymentMethods)
        .set({ isPreferred: false, updatedAt: new Date() })
        .where(eq(paymentMethods.id, row.id));
    }
  }
}

export const actions: Actions = {
  addPaymentMethod: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const formData = await request.formData();
    const provider = formData.get('provider');
    const rawHandle = formData.get('handle');

    if (typeof provider !== 'string' || !providerById(provider)) {
      return fail(400, { error: 'Pick how you want to be paid', action: 'addPaymentMethod' });
    }
    if (typeof rawHandle !== 'string') {
      return fail(400, { error: 'Enter your details', action: 'addPaymentMethod' });
    }

    const handle = normalizeHandle(provider, rawHandle);
    if (handle === '') {
      return fail(400, { error: 'Enter your details', action: 'addPaymentMethod' });
    }
    if (handle.length > 120) {
      return fail(400, { error: 'That is too long', action: 'addPaymentMethod' });
    }

    const existing = await db
      .select({ id: paymentMethods.id, provider: paymentMethods.provider })
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, locals.user.id));

    if (existing.length >= 6) {
      return fail(400, {
        error: 'That is as many as you can add',
        action: 'addPaymentMethod'
      });
    }
    if (existing.some((m) => m.provider === provider)) {
      return fail(400, {
        error: `You already have a ${providerById(provider)?.name} method. Edit it instead.`,
        action: 'addPaymentMethod'
      });
    }

    const id = generateId();
    const now = new Date();
    // The first one added is the preferred one: with nothing to compare against
    // there is no other sensible default.
    const isPreferred = existing.length === 0;

    await db.insert(paymentMethods).values({
      id,
      userId: locals.user.id,
      provider,
      handle,
      isPreferred,
      createdAt: now,
      updatedAt: now
    });

    return { success: true, action: 'addPaymentMethod', message: 'Payment method added' };
  },

  updatePaymentMethod: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const formData = await request.formData();
    const methodId = formData.get('methodId');
    const rawHandle = formData.get('handle');

    if (typeof methodId !== 'string' || typeof rawHandle !== 'string') {
      return fail(400, { error: 'Something went wrong', action: 'updatePaymentMethod' });
    }

    // Scoped to this user, so someone else's row cannot be edited by id
    const rows = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, locals.user.id)))
      .limit(1);

    if (rows.length === 0) {
      return fail(404, { error: 'Payment method not found', action: 'updatePaymentMethod' });
    }

    const handle = normalizeHandle(rows[0].provider, rawHandle);
    if (handle === '' || handle.length > 120) {
      return fail(400, { error: 'Enter your details', action: 'updatePaymentMethod' });
    }

    await db
      .update(paymentMethods)
      .set({ handle, updatedAt: new Date() })
      .where(eq(paymentMethods.id, methodId));

    return { success: true, action: 'updatePaymentMethod', message: 'Payment method updated' };
  },

  setPreferredPaymentMethod: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const formData = await request.formData();
    const methodId = formData.get('methodId');
    if (typeof methodId !== 'string') {
      return fail(400, { error: 'Something went wrong', action: 'setPreferredPaymentMethod' });
    }

    const rows = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, locals.user.id)))
      .limit(1);

    if (rows.length === 0) {
      return fail(404, {
        error: 'Payment method not found',
        action: 'setPreferredPaymentMethod'
      });
    }

    await db
      .update(paymentMethods)
      .set({ isPreferred: true, updatedAt: new Date() })
      .where(eq(paymentMethods.id, methodId));
    await clearOtherPreferred(locals.user.id, methodId);

    return { success: true, action: 'setPreferredPaymentMethod', message: 'Preferred method set' };
  },

  deletePaymentMethod: async ({ request, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const formData = await request.formData();
    const methodId = formData.get('methodId');
    if (typeof methodId !== 'string') {
      return fail(400, { error: 'Something went wrong', action: 'deletePaymentMethod' });
    }

    const rows = await db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, locals.user.id)))
      .limit(1);

    if (rows.length === 0) {
      return fail(404, { error: 'Payment method not found', action: 'deletePaymentMethod' });
    }

    await db.delete(paymentMethods).where(eq(paymentMethods.id, methodId));

    // Removing the preferred one would leave the household with no method to
    // lead with, so the oldest survivor takes over.
    if (rows[0].isPreferred) {
      const remaining = await db
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.userId, locals.user.id))
        .orderBy(asc(paymentMethods.createdAt))
        .limit(1);
      if (remaining.length > 0) {
        await db
          .update(paymentMethods)
          .set({ isPreferred: true, updatedAt: new Date() })
          .where(eq(paymentMethods.id, remaining[0].id));
      }
    }

    return { success: true, action: 'deletePaymentMethod', message: 'Payment method removed' };
  },

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
