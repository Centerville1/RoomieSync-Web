import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import {
  validatePasswordResetToken,
  deleteUserPasswordResetTokens
} from '$lib/server/password-reset';
import { deleteUserSessions } from '$lib/server/auth';

export const load: PageServerLoad = async ({ url, locals }) => {
  // Redirect if already logged in
  if (locals.user) {
    throw redirect(302, '/');
  }

  const token = url.searchParams.get('token');

  if (!token) {
    return { valid: false, error: 'Missing reset token' };
  }

  // Validate token
  const userId = await validatePasswordResetToken(token);

  if (!userId) {
    return { valid: false, error: 'Invalid or expired reset link' };
  }

  return { valid: true, token };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const token = formData.get('token');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    // Validate token presence
    if (typeof token !== 'string' || !token) {
      return fail(400, { error: 'Invalid reset token' });
    }

    // Validate password
    if (typeof password !== 'string' || !password || password.length < 6) {
      return fail(400, { error: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return fail(400, { error: 'Passwords do not match' });
    }

    // Validate token and get user ID
    const userId = await validatePasswordResetToken(token);

    if (!userId) {
      return fail(400, { error: 'Invalid or expired reset link. Please request a new one.' });
    }

    // Hash new password (same settings as signup)
    const hashedPassword = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    // Update user password
    await db
      .update(users)
      .set({
        hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Delete all reset tokens for this user
    await deleteUserPasswordResetTokens(userId);

    // Invalidate all existing sessions (security: force re-login)
    await deleteUserSessions(userId);

    // Return success - user will be redirected to login
    return { success: true };
  }
};
