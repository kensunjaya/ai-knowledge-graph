import { NextResponse } from 'next/server';
import { query, sql } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await query(
      "SELECT strName, strGraphJson, intVersion FROM dbo.TBL_KG_RESULT WHERE intUserRequestId = @id",
      [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
    );
    
    const row = result.recordset[0];
    if (!row) {
      return NextResponse.json({ error: 'Result not found.' }, { status: 404 });
    }
    
    const graphJson = row.strGraphJson;
    // Replace non-alphanumeric chars for safe filename
    const safeName = row.strName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const filename = `${safeName}_v${row.intVersion}.json`;
    
    return new NextResponse(graphJson, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Failed to download graph JSON:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
