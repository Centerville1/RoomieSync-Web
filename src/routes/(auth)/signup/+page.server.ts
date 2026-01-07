import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { generateId } from '$lib/server/utils';
import { createEmailVerificationToken } from '$lib/server/email-verification';
import { sendEmail } from '$lib/server/email';
import { getEmailVerificationEmail } from '$lib/server/email/templates';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, url }) => {
    const formData = await request.formData();
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    // Validation
    if (typeof name !== 'string' || !name || name.length < 2) {
      return fail(400, {
        error: 'Name must be at least 2 characters',
        name: name?.toString(),
        email: email?.toString()
      });
    }

    if (typeof email !== 'string' || !email || !/^.+@.+\..+$/.test(email)) {
      return fail(400, {
        error: 'Please enter a valid email address',
        name,
        email: email?.toString()
      });
    }

    if (typeof password !== 'string' || !password || password.length < 6) {
      return fail(400, {
        error: 'Password must be at least 6 characters',
        name,
        email
      });
    }

    if (password !== confirmPassword) {
      return fail(400, {
        error: 'Passwords do not match',
        name,
        email
      });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      // If user exists but isn't verified, allow resending verification
      if (!existingUser[0].emailVerified) {
        const token = await createEmailVerificationToken(existingUser[0].id);
        const verificationLink = `${url.origin}/verify-email?token=${token}`;
        const { html, text } = getEmailVerificationEmail({
          userName: existingUser[0].name,
          verificationLink
        });

        await sendEmail({
          to: existingUser[0].email,
          subject: 'Verify your RoomieSync email',
          html,
          text
        });

        throw redirect(302, '/verify-email/pending');
      }

      return fail(400, {
        error: 'An account with this email already exists',
        name,
        email
      });
    }

    // Hash password
    const hashedPassword = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    // Create user (not verified yet)
    const userId = generateId();
    const now = new Date();

    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      hashedPassword,
      name,
      emailVerified: false,
      createdAt: now,
      updatedAt: now
    });

    // Create verification token and send email
    const token = await createEmailVerificationToken(userId);
    const verificationLink = `${url.origin}/verify-email?token=${token}`;
    const { html, text } = getEmailVerificationEmail({
      userName: name,
      verificationLink
    });

    await sendEmail({
      to: email.toLowerCase(),
      subject: 'Verify your RoomieSync email',
      html,
      text
    });

    throw redirect(302, '/verify-email/pending');
  }
};
