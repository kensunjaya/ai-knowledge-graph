import { NextResponse } from 'next/server';
import {
  getAllSecretsMetadata,
  createSecret,
  updateSecret,
  deleteSecret,
} from '@/lib/secrets';
import { encryptText } from '@/lib/crypto';
import { jsonResponse, errorResponse } from '@/lib/api';

export async function GET() {
  try {
    const secrets = await getAllSecretsMetadata();
    return jsonResponse(secrets);
  } catch (error: any) {
    console.error('Failed to fetch secrets:', error);
    return errorResponse(error.message || 'Failed to fetch secrets', 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { name, providerId, description, value, masterKey, isActive, expiresAt } = body;

    if (!name || !name.trim()) {
      return errorResponse('Secret name is required');
    }
    if (!providerId) {
      return errorResponse('Provider is required');
    }
    if (value === undefined || value === null || value === '') {
      return errorResponse('Secret value is required');
    }
    if (!masterKey || typeof masterKey !== 'string') {
      return errorResponse('Master Key is required to encrypt secret');
    }

    // Encrypt secret value
    const { encryptedValue, salt, nonce } = encryptText(value, masterKey);

    // Clear masterKey variable
    masterKey = undefined as any;
    value = undefined as any;

    const secret = await createSecret({
      name: name.trim(),
      providerId: parseInt(providerId, 10),
      description: description ? description.trim() : null,
      encryptedValue,
      salt,
      nonce,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      expiresAt: expiresAt || null,
    });

    return jsonResponse(secret, 201);
  } catch (error: any) {
    console.error('Failed to create secret:', error);
    return errorResponse(error.message || 'Failed to create secret', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    let { id, name, providerId, description, value, masterKey, isActive, expiresAt } = body;

    if (!id) {
      return errorResponse('Secret ID is required');
    }
    if (!name || !name.trim()) {
      return errorResponse('Secret name is required');
    }
    if (!providerId) {
      return errorResponse('Provider is required');
    }

    let encryptedData: { encryptedValue: Buffer; salt: Buffer; nonce: Buffer } | undefined;

    if (value !== undefined && value !== null && value !== '') {
      if (!masterKey || typeof masterKey !== 'string') {
        return errorResponse('Master Key is required to re-encrypt secret value');
      }
      encryptedData = encryptText(value, masterKey);
      masterKey = undefined as any;
      value = undefined as any;
    }

    const updated = await updateSecret(id, {
      name: name.trim(),
      providerId: parseInt(providerId, 10),
      description: description ? description.trim() : null,
      encryptedValue: encryptedData?.encryptedValue,
      salt: encryptedData?.salt,
      nonce: encryptedData?.nonce,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      expiresAt: expiresAt !== undefined ? expiresAt : undefined,
    });

    if (!updated) {
      return errorResponse('Secret not found', 404);
    }

    return jsonResponse(updated);
  } catch (error: any) {
    console.error('Failed to update secret:', error);
    return errorResponse(error.message || 'Failed to update secret', 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    let id = idParam;

    if (!id) {
      const body = await req.json().catch(() => ({}));
      if (body.id) id = body.id;
    }

    if (!id) {
      return errorResponse('Secret ID is required');
    }

    const deleted = await deleteSecret(id);
    if (!deleted) {
      return errorResponse('Secret not found or could not be deleted', 404);
    }

    return jsonResponse({ success: true, message: 'Secret deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete secret:', error);
    return errorResponse(error.message || 'Failed to delete secret', 500);
  }
}
