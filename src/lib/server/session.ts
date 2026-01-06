import { db } from './db/client';
import { sessions, users, type User } from './db/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE_NAME = 'session';
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface SessionWithUser extends Session {
	user: User;
}

// Generate cryptographically secure random string
function generateSecureRandomString(): string {
	const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);

	let id = '';
	for (let i = 0; i < bytes.length; i++) {
		id += alphabet[bytes[i] >> 3];
	}
	return id;
}

// Hash session secret using SHA-256
async function hashSecret(secret: string): Promise<Uint8Array> {
	const secretBytes = new TextEncoder().encode(secret);
	const secretHashBuffer = await crypto.subtle.digest('SHA-256', secretBytes);
	return new Uint8Array(secretHashBuffer);
}

// Constant-time comparison to prevent timing attacks
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;
	let c = 0;
	for (let i = 0; i < a.byteLength; i++) {
		c |= a[i] ^ b[i];
	}
	return c === 0;
}

// Create a new session for a user
export async function createSession(userId: string): Promise<string> {
	const sessionId = generateSecureRandomString();
	const sessionSecret = generateSecureRandomString();
	const secretHash = await hashSecret(sessionSecret);
	const expiresAt = new Date(Date.now() + SESSION_EXPIRES_IN_SECONDS * 1000);

	// Convert Uint8Array to hex string for storage
	const secretHashHex = Array.from(secretHash)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	await db.insert(sessions).values({
		id: sessionId,
		userId,
		secretHash: secretHashHex,
		expiresAt
	});

	// Return session token (id.secret)
	return `${sessionId}.${sessionSecret}`;
}

// Validate a session token
export async function validateSessionToken(token: string): Promise<SessionWithUser | null> {
	const [sessionId, sessionSecret] = token.split('.');
	if (!sessionId || !sessionSecret) {
		return null;
	}

	const result = await db
		.select({
			session: sessions,
			user: users
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	const { session, user } = result[0];

	// Convert hex string back to Uint8Array
	const storedHashHex = session.secretHash;
	const storedHash = new Uint8Array(
		storedHashHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
	);

	// Verify the secret
	const tokenSecretHash = await hashSecret(sessionSecret);
	if (!constantTimeEqual(tokenSecretHash, storedHash)) {
		return null;
	}

	// Check if session is expired
	if (session.expiresAt.getTime() <= Date.now()) {
		await deleteSession(sessionId);
		return null;
	}

	return {
		id: session.id,
		userId: session.userId,
		expiresAt: session.expiresAt,
		user
	};
}

// Delete a session
export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// Delete all sessions for a user
export async function deleteUserSessions(userId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

// Session cookie helpers
export function createSessionCookie(token: string): {
	name: string;
	value: string;
	attributes: Record<string, any>;
} {
	return {
		name: SESSION_COOKIE_NAME,
		value: token,
		attributes: {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			maxAge: SESSION_EXPIRES_IN_SECONDS,
			secure: process.env.NODE_ENV === 'production'
		}
	};
}

export function createBlankSessionCookie(): {
	name: string;
	value: string;
	attributes: Record<string, any>;
} {
	return {
		name: SESSION_COOKIE_NAME,
		value: '',
		attributes: {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			maxAge: 0,
			secure: process.env.NODE_ENV === 'production'
		}
	};
}

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
