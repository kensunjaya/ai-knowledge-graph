import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const sqlQuery = `
      SELECT 
        t.intGraphId AS graphId,
        t.strName AS name,
        t.intVersion AS version
      FROM dbo.TBL_KG_RESULT t
      INNER JOIN (
        SELECT intGraphId, MAX(intVersion) AS max_version
        FROM dbo.TBL_KG_RESULT
        GROUP BY intGraphId
      ) m ON t.intGraphId = m.intGraphId AND t.intVersion = m.max_version
      ORDER BY t.strName ASC
    `;
    
    const result = await query(sqlQuery);
    return NextResponse.json(result.recordset);
  } catch (error: any) {
    console.error('Failed to query target graphs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
