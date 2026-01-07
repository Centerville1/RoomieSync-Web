import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '$lib/server/email';
import { getPasswordResetEmail } from '$lib/server/email/templates';
import {
  createPasswordResetToken,
  checkRateLimit,
  recordAttempt
} from '$lib/server/password-reset';

export const load: PageServerLoad = async ({ locals }) => {
  // Redirect if already logged in
  if (locals.user) {
    throw redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, url }) => {
    const formData = await request.formData();
    const email = formData.get('email');

    // Validate email format
    if (typeof email !== 'string' || !email || !/^.+@.+\..+$/.test(email)) {
      return fail(400, {
        error: 'Please enter a valid email address',
        email: email?.toString()
      });
    }

    const normalizedEmail = email.toLowerCase();

    // Check rate limit BEFORE revealing if email exists
    const canProceed = checkRateLimit(normalizedEmail);
    if (!canProceed) {
      // Generic message - don't reveal rate limit hit vs email not found
      return {
        success: true,
        message: 'If an account with that email exists, we sent a password reset link.'
      };
    }

    // Record this attempt
    recordAttempt(normalizedEmail);

    // Look up user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // IMPORTANT: Always return success message to prevent email enumeration
    if (existingUser.length === 0) {
      return {
        success: true,
        message: 'If an account with that email exists, we sent a password reset link.'
      };
    }

    const user = existingUser[0];

    // Create token and send email
    const token = await createPasswordResetToken(user.id);
    const resetLink = `${url.origin}/reset-password?token=${token}`;

    const { html, text } = getPasswordResetEmail({
      userName: user.name,
      resetLink
    });

    await sendEmail({
      to: user.email,
      subject: 'Reset Your RoomieSync Password',
      html,
      text
    });

    return {
      success: true,
      message: 'If an account with that email exists, we sent a password reset link.'
    };
  }
};
