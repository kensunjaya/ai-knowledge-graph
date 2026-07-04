import { NextResponse } from 'next/server';
import { executeProc, query, sql } from '@/lib/db';
import { runPythonPipeline } from '@/lib/python-runner';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Load original request details and raw text
    const reqRes = await query(
      "SELECT strTitle, strRequestType, intTargetKgId " +
      "FROM dbo.TBL_USER_REQUEST WHERE intId = @id",
      [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
    );
    
    const originalRequest = reqRes.recordset[0];
    if (!originalRequest) {
      return NextResponse.json({ error: 'Original request not found.' }, { status: 404 });
    }
    
    const textRes = await query(
      "SELECT strRawText FROM dbo.TBL_RAW_TEXT WHERE intUserRequestId = @id",
      [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
    );
    
    const rawTextRow = textRes.recordset[0];
    if (!rawTextRow) {
      return NextResponse.json({ error: 'Original raw text not found.' }, { status: 404 });
    }

    // Call stored procedure to create a new cloned request
    const title = originalRequest.strTitle.startsWith('Regen: ') 
      ? originalRequest.strTitle 
      : `Regen: ${originalRequest.strTitle}`;
      
    const result = await executeProc('dbo.usp_UserRequest_Create', [
      { name: 'strTitle', type: sql.NVarChar(255), value: title },
      { name: 'strRequestType', type: sql.VarChar(20), value: originalRequest.strRequestType },
      { name: 'strRawText', type: sql.NVarChar(sql.MAX), value: rawTextRow.strRawText },
      { name: 'intTargetKgId', type: sql.UniqueIdentifier(), value: originalRequest.intTargetKgId || null },
    ]);

    const createdRequest = result.recordset[0];
    if (!createdRequest || !createdRequest.intUserRequestId) {
      throw new Error('Stored procedure failed to return request ID.');
    }

    const newRequestId = createdRequest.intUserRequestId;

    // Run Python pipeline asynchronously for the new cloned request
    runPythonPipeline(newRequestId, originalRequest.strRequestType);

    return NextResponse.json({
      success: true,
      requestId: newRequestId,
      status: 'PENDING',
    });
  } catch (error: any) {
    console.error('Failed to regenerate request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
