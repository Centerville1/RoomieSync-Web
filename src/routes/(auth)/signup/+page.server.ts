import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { users, invites } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { generateId } from '$lib/server/utils';
import { createEmailVerificationToken } from '$lib/server/email-verification';
import { sendEmail } from '$lib/server/email';
import { getEmailVerificationEmail } from '$lib/server/email/templates';
import { verifyInviteSignature } from '$lib/server/invite-signature';
import { createSession, createSessionCookie } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user) {
    throw redirect(302, '/');
  }

  // Get invite parameters from URL for prefilling
  const email = url.searchParams.get('email') || '';
  const inviteId = url.searchParams.get('invite') || '';
  const sig = url.searchParams.get('sig') || '';

  return {
    prefillEmail: email,
    inviteId,
    sig
  };
};

export const actions: Actions = {
  default: async ({ request, url, cookies }) => {
    const formData = await request.formData();
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    // Get invite params from hidden fields
    const inviteId = formData.get('inviteId') as string | null;
    const sig = formData.get('sig') as string | null;
    const originalEmail = formData.get('originalEmail') as string | null;

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

    const normalizedEmail = email.toLowerCase();

    // Check if this signup should be auto-verified via invite link
    let autoVerified = false;
    if (inviteId && sig && originalEmail) {
      // Only auto-verify if email matches the original invite email
      if (normalizedEmail === originalEmail.toLowerCase()) {
        // Verify the signature is valid
        const signatureValid = await verifyInviteSignature(inviteId, normalizedEmail, sig);
        if (signatureValid) {
          // Verify the invite exists and is unused
          const invite = await db
            .select()
            .from(invites)
            .where(and(eq(invites.id, inviteId), eq(invites.used, false)))
            .limit(1);
          if (invite.length > 0 && invite[0].invitedEmail === normalizedEmail) {
            autoVerified = true;
          }
        }
      }
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
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

    // Create user (verified if coming from valid invite link with unchanged email)
    const userId = generateId();
    const now = new Date();

    await db.insert(users).values({
      id: userId,
      email: normalizedEmail,
      hashedPassword,
      name,
      emailVerified: autoVerified,
      createdAt: now,
      updatedAt: now
    });

    if (autoVerified) {
      // Skip email verification - log them in directly
      const sessionToken = await createSession(userId);
      const sessionCookie = createSessionCookie(sessionToken);
      cookies.set(sessionCookie.name, sessionCookie.value, {
        path: '.',
        ...sessionCookie.attributes
      });
      throw redirect(302, '/');
    }

    // Create verification token and send email
    const token = await createEmailVerificationToken(userId);
    const verificationLink = `${url.origin}/verify-email?token=${token}`;
    const { html, text } = getEmailVerificationEmail({
      userName: name,
      verificationLink
    });

    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your RoomieSync email',
      html,
      text
    });

    throw redirect(302, '/verify-email/pending');
  }
};
