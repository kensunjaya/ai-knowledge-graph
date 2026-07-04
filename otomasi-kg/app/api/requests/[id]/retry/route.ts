import { NextResponse } from 'next/server';
import { query, sql } from '@/lib/db';
import { runPythonPipeline } from '@/lib/python-runner';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if request exists and is FAILED
    const checkRes = await query(
      "SELECT strStatus, strRequestType FROM dbo.TBL_USER_REQUEST WHERE intId = @id",
      [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
    );
    
    // Check if there is any other request currently in PROCESSING status
    const activeRes = await query(
      "SELECT intId FROM dbo.TBL_USER_REQUEST WHERE strStatus = 'PROCESSING'"
    );
    if (activeRes.recordset.length > 0) {
      return NextResponse.json(
        { error: 'Another request is currently processing. Please wait until it completes.' },
        { status: 400 }
      );
    }

    const request = checkRes.recordset[0];
    if (!request) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }
    if (request.strStatus !== 'FAILED') {
      return NextResponse.json({ error: 'Only FAILED requests can be retried.' }, { status: 400 });
    }

    // Reset status to PROCESSING synchronously, clear errors & completed timestamp, set started timestamp
    await query(
      "UPDATE dbo.TBL_USER_REQUEST " +
      "SET strStatus = 'PROCESSING', " +
      "    strErrorMessage = NULL, " +
      "    dtStartedAt = SYSDATETIME(), " +
      "    dtCompletedAt = NULL " +
      "WHERE intId = @id",
      [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
    );

    // Run Python pipeline asynchronously
    runPythonPipeline(id, request.strRequestType);

    return NextResponse.json({ success: true, status: 'PROCESSING' });
  } catch (error: any) {
    console.error('Failed to retry request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
