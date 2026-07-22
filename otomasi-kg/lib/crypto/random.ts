import crypto from 'crypto';

/**
 * Generates cryptographically secure random bytes.
 * @param length Number of bytes to generate
 */
export function generateRandomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Generates a random 32-byte salt for PBKDF2 key derivation.
 */
export function generateSalt(): Buffer {
  return generateRandomBytes(32);
}

/**
 * Generates a random 12-byte nonce (IV) for AES-256-GCM.
 */
export function generateNonce(): Buffer {
  return generateRandomBytes(12);
}
