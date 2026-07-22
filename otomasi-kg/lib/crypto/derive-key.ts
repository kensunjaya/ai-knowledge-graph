import crypto from 'crypto';

/**
 * Derives a 256-bit (32-byte) AES key from a Master Key and salt using PBKDF2 (SHA-256).
 *
 * @param masterKey The user's Master Key string
 * @param salt The 32-byte salt buffer
 * @param iterations PBKDF2 iteration count (default 100,000)
 * @returns 32-byte derived key Buffer
 */
export function deriveKey(masterKey: string, salt: Buffer, iterations: number = 100000): Buffer {
  if (!masterKey || typeof masterKey !== 'string') {
    throw new Error('Master key must be a non-empty string');
  }
  if (!salt || salt.length < 16) {
    throw new Error('Salt must be at least 16 bytes');
  }

  return crypto.pbkdf2Sync(masterKey, salt, iterations, 32, 'sha256');
}
