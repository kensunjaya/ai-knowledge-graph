import { NextResponse } from 'next/server';
import {
  getAllProviders,
  createProvider,
  updateProvider,
  deleteProvider,
} from '@/lib/providers';
import { jsonResponse, errorResponse } from '@/lib/api';

export async function GET() {
  try {
    const providers = await getAllProviders();
    return jsonResponse(providers);
  } catch (error: any) {
    console.error('Failed to get providers:', error);
    return errorResponse(error.message || 'Failed to fetch providers', 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, category, baseUrl, description, iconSvg } = body;

    if (!name || !name.trim()) {
      return errorResponse('Provider name is required');
    }

    const provider = await createProvider({
      name: name.trim(),
      category: category ? category.trim() : null,
      baseUrl: baseUrl ? baseUrl.trim() : null,
      description: description ? description.trim() : null,
      iconSvg: iconSvg ? iconSvg.trim() : null,
    });

    return jsonResponse(provider, 201);
  } catch (error: any) {
    console.error('Failed to create provider:', error);
    return errorResponse(error.message || 'Failed to create provider', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, category, baseUrl, description, iconSvg } = body;

    if (!id || typeof id !== 'number') {
      return errorResponse('Provider ID is required');
    }
    if (!name || !name.trim()) {
      return errorResponse('Provider name is required');
    }

    const updated = await updateProvider(id, {
      name: name.trim(),
      category: category ? category.trim() : null,
      baseUrl: baseUrl ? baseUrl.trim() : null,
      description: description ? description.trim() : null,
      iconSvg: iconSvg ? iconSvg.trim() : null,
    });

    if (!updated) {
      return errorResponse('Provider not found', 404);
    }

    return jsonResponse(updated);
  } catch (error: any) {
    console.error('Failed to update provider:', error);
    return errorResponse(error.message || 'Failed to update provider', 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    let id = idParam ? parseInt(idParam, 10) : null;

    if (!id) {
      const body = await req.json().catch(() => ({}));
      if (body.id) id = body.id;
    }

    if (!id) {
      return errorResponse('Provider ID is required');
    }

    const deleted = await deleteProvider(id);
    if (!deleted) {
      return errorResponse('Provider not found or could not be deleted', 404);
    }

    return jsonResponse({ success: true, message: 'Provider deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete provider:', error);
    return errorResponse(error.message || 'Failed to delete provider', 500);
  }
}
