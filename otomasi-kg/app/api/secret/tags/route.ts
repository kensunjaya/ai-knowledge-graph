import { NextResponse } from 'next/server';
import { getAllTags, createTag, deleteTag } from '@/lib/tags';
import { jsonResponse, errorResponse } from '@/lib/api';

export async function GET() {
  try {
    const tags = await getAllTags();
    return jsonResponse(tags);
  } catch (error: any) {
    console.error('Failed to fetch tags:', error);
    return errorResponse(error.message || 'Failed to fetch tags', 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return errorResponse('Tag name is required');
    }

    const tag = await createTag(name.trim());
    return jsonResponse(tag, 201);
  } catch (error: any) {
    console.error('Failed to create tag:', error);
    return errorResponse(error.message || 'Failed to create tag', 500);
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
      return errorResponse('Tag ID is required');
    }

    const deleted = await deleteTag(id);
    if (!deleted) {
      return errorResponse('Tag not found or could not be deleted', 404);
    }

    return jsonResponse({ success: true, message: 'Tag deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete tag:', error);
    return errorResponse(error.message || 'Failed to delete tag', 500);
  }
}
