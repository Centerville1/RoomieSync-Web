import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession, createSessionCookie } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) {
    throw redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    // Validation
    if (typeof email !== 'string' || !email || !/^.+@.+\..+$/.test(email)) {
      return fail(400, {
        error: 'Please enter a valid email address',
        email: email?.toString()
      });
    }

    if (typeof password !== 'string' || !password || password.length < 6) {
      return fail(400, {
        error: 'Password must be at least 6 characters',
        email
      });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length === 0) {
      return fail(400, {
        error: 'Invalid email or password',
        email
      });
    }

    const user = existingUser[0];

    // Verify password
    const validPassword = await verify(user.hashedPassword, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    if (!validPassword) {
      return fail(400, {
        error: 'Invalid email or password',
        email
      });
    }

    // Create session
    const sessionToken = await createSession(user.id);
    const sessionCookie = createSessionCookie(sessionToken);
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes
    });

    throw redirect(302, '/');
  }
};
