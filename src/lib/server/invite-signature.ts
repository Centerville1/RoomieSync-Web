import { env } from '$env/dynamic/private';

// Get the HMAC secret, falling back to a derived value from TURSO_AUTH_TOKEN
function getHmacSecret(): string {
  if (env.INVITE_HMAC_SECRET) {
    return env.INVITE_HMAC_SECRET;
  }
  // Fall back to deriving from TURSO_AUTH_TOKEN with a prefix
  // This ensures we have a secret even if INVITE_HMAC_SECRET isn't set
  if (env.TURSO_AUTH_TOKEN) {
    return `invite-hmac:${env.TURSO_AUTH_TOKEN}`;
  }
  throw new Error('No INVITE_HMAC_SECRET or TURSO_AUTH_TOKEN configured');
}

/**
 * Create a cryptographic signature for an invite link
 * This proves the user clicked from the invite email
 */
export async function createInviteSignature(inviteId: string, email: string): Promise<string> {
  const secret = getHmacSecret();
  const data = `${inviteId}:${email.toLowerCase()}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = new Uint8Array(signature);

  // Convert to URL-safe base64
  return btoa(String.fromCharCode(...signatureArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Verify a cryptographic signature for an invite link
 * Returns true if the signature is valid
 */
export async function verifyInviteSignature(
  inviteId: string,
  email: string,
  signature: string
): Promise<boolean> {
  try {
    const expectedSignature = await createInviteSignature(inviteId, email);
    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}
