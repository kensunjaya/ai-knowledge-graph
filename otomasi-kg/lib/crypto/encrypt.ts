import crypto from 'crypto';
import { generateSalt, generateNonce } from './random';
import { deriveKey } from './derive-key';

export interface EncryptResult {
  encryptedValue: Buffer;
  salt: Buffer;
  nonce: Buffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM and a Master Key.
 * Generates a random salt and nonce automatically if not provided.
 *
 * @param plaintext The secret text to encrypt
 * @param masterKey The Master Key supplied by the user
 * @param customSalt Optional pre-generated salt
 * @param customNonce Optional pre-generated 12-byte nonce
 * @returns EncryptResult containing encryptedValue (cipher + authTag), salt, and nonce
 */
export function encryptText(
  plaintext: string,
  masterKey: string,
  customSalt?: Buffer,
  customNonce?: Buffer
): EncryptResult {
  const salt = customSalt || generateSalt();
  const nonce = customNonce || generateNonce();
  const key = deriveKey(masterKey, salt);

  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Combine cipher text and 16-byte GCM authentication tag
    const encryptedValue = Buffer.concat([encrypted, authTag]);

    return {
      encryptedValue,
      salt,
      nonce,
    };
  } finally {
    // Zero out memory of the derived key
    key.fill(0);
  }
}
