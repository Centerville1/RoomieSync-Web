import { randomUUID } from 'crypto';

/**
 * Generate a unique ID using Node.js crypto.randomUUID()
 * Returns a RFC 4122 version 4 UUID
 */
export function generateId(): string {
  return randomUUID();
}
