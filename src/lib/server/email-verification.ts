import { db } from './db/client';
import { emailVerificationTokens, users } from './db/schema';
import { eq, lt } from 'drizzle-orm';
import { generateId } from './utils';

const TOKEN_EXPIRES_IN_HOURS = 24;

// Generate cryptographically secure random string
function generateSecureToken(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}

// Hash token using SHA-256
async function hashToken(token: string): Promise<string> {
  const tokenBytes = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create an email verification token for a user
 * @returns The raw token (to be sent in email)
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  // Delete any existing tokens for this user
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));

  const token = generateSecureToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRES_IN_HOURS * 60 * 60 * 1000);

  await db.insert(emailVerificationTokens).values({
    id: generateId(),
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date()
  });

  return token;
}

/**
 * Validate an email verification token and mark the user's email as verified
 * @returns true if successful, false otherwise
 */
export async function verifyEmail(token: string): Promise<boolean> {
  const tokenHash = await hashToken(token);

  const result = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  const verificationToken = result[0];

  // Check expiration
  if (verificationToken.expiresAt.getTime() <= Date.now()) {
    // Delete expired token
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, verificationToken.id));
    return false;
  }

  // Mark user's email as verified
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, verificationToken.userId));

  // Delete the token
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.id, verificationToken.id));

  return true;
}

/**
 * Delete all email verification tokens for a user
 */
export async function deleteUserEmailVerificationTokens(userId: string): Promise<void> {
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
}

/**
 * Cleanup expired tokens (can be called periodically)
 */
export async function cleanupExpiredEmailVerificationTokens(): Promise<void> {
  const now = new Date();
  await db.delete(emailVerificationTokens).where(lt(emailVerificationTokens.expiresAt, now));
}
