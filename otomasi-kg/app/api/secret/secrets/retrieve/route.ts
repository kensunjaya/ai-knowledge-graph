import { NextResponse } from 'next/server';
import { getRawSecretByIdentifier, updateSecretLastUsed } from '@/lib/secrets';
import { decryptText } from '@/lib/crypto';
import { jsonResponse, errorResponse } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { identifier, masterKey } = body;

    if (!identifier || typeof identifier !== 'string') {
      return errorResponse('Secret identifier (name or ID) is required');
    }
    if (!masterKey || typeof masterKey !== 'string') {
      return errorResponse('Master Key is required');
    }

    const secretRecord = await getRawSecretByIdentifier(identifier.trim());
    if (!secretRecord) {
      return errorResponse(`Secret '${identifier}' not found`, 404);
    }

    if (!secretRecord.isActive) {
      return errorResponse('Secret is currently inactive', 403);
    }

    if (secretRecord.expiresAt && new Date(secretRecord.expiresAt) < new Date()) {
      return errorResponse('Secret has expired', 403);
    }

    let plaintext: string;
    try {
      plaintext = decryptText(
        secretRecord.encryptedValue,
        secretRecord.salt,
        secretRecord.nonce,
        masterKey
      );
    } catch (err: any) {
      return errorResponse(err.message || 'Decryption failed. Check Master Key.', 401);
    } finally {
      // Discard master key immediately
      masterKey = undefined as any;
    }

    // Update last used timestamp asynchronously
    updateSecretLastUsed(secretRecord.id).catch((e) =>
      console.error('Failed to update last used timestamp:', e)
    );

    return jsonResponse({
      success: true,
      id: secretRecord.id,
      name: secretRecord.name,
      value: plaintext,
    });
  } catch (error: any) {
    console.error('Failed to retrieve secret:', error);
    return errorResponse(error.message || 'Internal Server Error', 500);
  }
}
