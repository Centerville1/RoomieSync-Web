import { db } from './db/client';
import { passwordResetTokens } from './db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { generateId } from './utils';

const TOKEN_EXPIRES_IN_MINUTES = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 3;

// In-memory rate limiting (resets on server restart)
// For production at scale, consider using Redis or database-backed rate limiting
const rateLimitMap = new Map<string, number[]>();

// Generate cryptographically secure random string (same pattern as session.ts)
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

// Hash token using SHA-256 (same pattern as session.ts)
async function hashToken(token: string): Promise<string> {
  const tokenBytes = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if an email has exceeded the rate limit for password reset requests
 */
export function checkRateLimit(email: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Get existing attempts and filter to current window
  const attempts = rateLimitMap.get(normalizedEmail) || [];
  const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);

  // Update the map with only recent attempts
  rateLimitMap.set(normalizedEmail, recentAttempts);

  return recentAttempts.length < MAX_REQUESTS_PER_WINDOW;
}

/**
 * Record a password reset attempt for rate limiting
 */
export function recordAttempt(email: string): void {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();

  const attempts = rateLimitMap.get(normalizedEmail) || [];
  attempts.push(now);
  rateLimitMap.set(normalizedEmail, attempts);
}

/**
 * Create a password reset token for a user
 * @returns The raw token (to be sent in email)
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  // Delete any existing tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

  const token = generateSecureToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRES_IN_MINUTES * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    id: generateId(),
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date()
  });

  return token;
}

/**
 * Validate a password reset token
 * @returns The user ID if valid, null otherwise
 */
export async function validatePasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = await hashToken(token);

  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const resetToken = result[0];

  // Check expiration
  if (resetToken.expiresAt.getTime() <= Date.now()) {
    // Delete expired token
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id));
    return null;
  }

  return resetToken.userId;
}

/**
 * Delete all password reset tokens for a user (call after successful password reset)
 */
export async function deleteUserPasswordResetTokens(userId: string): Promise<void> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
}

/**
 * Cleanup expired tokens (can be called periodically)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now));
}
