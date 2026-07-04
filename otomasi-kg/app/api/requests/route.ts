import { NextResponse } from 'next/server';
import { executeProc, query, sql } from '@/lib/db';
import { runPythonPipeline } from '@/lib/python-runner';

export async function GET() {
  try {
    const sqlQuery = `
      SELECT 
        r.intId AS requestId,
        r.strTitle AS title,
        r.strRequestType AS requestType,
        r.strStatus AS status,
        r.dtCreatedAt AS createdAt,
        r.dtStartedAt AS startedAt,
        r.dtCompletedAt AS completedAt,
        r.strErrorMessage AS errorMessage,
        r.intTargetKgId AS targetKgId,
        res.intId AS resultId,
        res.intGraphId AS graphId,
        res.intVersion AS version
      FROM dbo.TBL_USER_REQUEST r
      LEFT JOIN (
        SELECT intUserRequestId, intId, intGraphId, intVersion,
               ROW_NUMBER() OVER (PARTITION BY intUserRequestId ORDER BY intVersion DESC) as rn
        FROM dbo.TBL_KG_RESULT
      ) res ON r.intId = res.intUserRequestId AND res.rn = 1
      ORDER BY r.dtCreatedAt DESC
    `;
    
    const result = await query(sqlQuery);
    return NextResponse.json(result.recordset);
  } catch (error: any) {
    console.error('Failed to query requests:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title, requestType, rawText, targetKgId } = await req.json();

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }
    if (!requestType || (requestType !== 'INITIAL' && requestType !== 'ADD')) {
      return NextResponse.json({ error: 'Request type must be INITIAL or ADD.' }, { status: 400 });
    }
    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ error: 'Raw text is required.' }, { status: 400 });
    }
    if (requestType === 'ADD' && !targetKgId) {
      return NextResponse.json({ error: 'Target Knowledge Graph ID is required for ADD requests.' }, { status: 400 });
    }

    // Call stored procedure to create the request
    const result = await executeProc('dbo.usp_UserRequest_Create', [
      { name: 'strTitle', type: sql.NVarChar(255), value: title.trim() },
      { name: 'strRequestType', type: sql.VarChar(20), value: requestType },
      { name: 'strRawText', type: sql.NVarChar(sql.MAX), value: rawText.trim() },
      { name: 'intTargetKgId', type: sql.UniqueIdentifier(), value: targetKgId || null },
    ]);

    const createdRequest = result.recordset[0];
    if (!createdRequest || !createdRequest.intUserRequestId) {
      throw new Error('Stored procedure failed to return request ID.');
    }

    const requestId = createdRequest.intUserRequestId;

    // Check if there is any other request currently in PROCESSING status
    const activeRes = await query(
      "SELECT intId FROM dbo.TBL_USER_REQUEST WHERE strStatus = 'PROCESSING'"
    );
    const isAnyProcessing = activeRes.recordset.length > 0;

    // Run Python pipeline asynchronously only if no other request is currently processing
    if (!isAnyProcessing) {
      // Update status to PROCESSING in the database synchronously
      await query(
        "UPDATE dbo.TBL_USER_REQUEST SET strStatus = 'PROCESSING', dtStartedAt = SYSDATETIME() WHERE intId = @id",
        [{ name: 'id', type: sql.UniqueIdentifier(), value: requestId }]
      );
      runPythonPipeline(requestId, requestType);
    }

    return NextResponse.json({
      success: true,
      requestId,
      status: 'PENDING',
      autoStarted: !isAnyProcessing
    });
  } catch (error: any) {
    console.error('Failed to create request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
