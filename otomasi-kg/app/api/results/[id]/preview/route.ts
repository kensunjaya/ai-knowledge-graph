import { NextResponse } from 'next/server';
import { query, sql } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await query(
      "SELECT strGraphHtml FROM dbo.TBL_KG_RESULT WHERE intUserRequestId = @id",
      [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
    );
    
    const row = result.recordset[0];
    if (!row || !row.strGraphHtml) {
      return new NextResponse('<h1>Visualization HTML not found</h1>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    return new NextResponse(row.strGraphHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Failed to load graph HTML preview:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
