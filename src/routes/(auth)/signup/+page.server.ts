import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession, createSessionCookie } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';

// Generate random ID
function generateId(): string {
	const timestamp = Date.now().toString(36);
	const randomPart = Math.random().toString(36).substring(2, 15);
	return `${timestamp}${randomPart}`;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
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

		// Create user
		const userId = generateId();
		const now = new Date();

		await db.insert(users).values({
			id: userId,
			email: email.toLowerCase(),
			hashedPassword,
			name,
			createdAt: now,
			updatedAt: now
		});

		// Create session
		const sessionToken = await createSession(userId);
		const sessionCookie = createSessionCookie(sessionToken);
		cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		throw redirect(302, '/');
	}
};
