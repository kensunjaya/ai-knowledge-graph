import crypto from 'crypto';
import { deriveKey } from './derive-key';

/**
 * Decrypts an AES-256-GCM encrypted buffer using a salt, nonce, and Master Key.
 *
 * @param encryptedValue Combined cipher text and 16-byte GCM authentication tag
 * @param salt 32-byte salt buffer used during key derivation
 * @param nonce 12-byte nonce (IV) buffer
 * @param masterKey Master Key supplied by the user
 * @returns Decrypted plaintext string
 */
export function decryptText(
  encryptedValue: Buffer,
  salt: Buffer,
  nonce: Buffer,
  masterKey: string
): string {
  if (!encryptedValue || encryptedValue.length < 16) {
    throw new Error('Invalid encrypted payload (missing authentication tag)');
  }

  const key = deriveKey(masterKey, salt);

  try {
    // Separate cipher text and 16-byte authentication tag
    const authTag = encryptedValue.subarray(encryptedValue.length - 16);
    const cipherText = encryptedValue.subarray(0, encryptedValue.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);

    const decrypted = decipher.update(cipherText) + decipher.final('utf8');
    return decrypted;
  } catch (error: any) {
    throw new Error('Failed to decrypt secret. Check that your Master Key is correct.');
  } finally {
    // Zero out memory of the derived key immediately
    key.fill(0);
  }
}
