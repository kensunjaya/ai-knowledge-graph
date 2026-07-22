import { spawn } from 'child_process';
import path from 'path';
import { query, sql } from './db';

export function runPythonPipeline(requestId: string, type: 'INITIAL' | 'ADD') {
  const pythonPath = process.env.PYTHON_EXECUTABLE || 'python';
  const projectPath = process.env.KG_PYTHON_PROJECT_PATH || '';
  
  const scriptName = type === 'INITIAL' ? 'generate-graph.py' : 'update-graph.py';
  const scriptPath = path.join(projectPath, scriptName);
  
  console.log(`Spawning Python process: ${pythonPath} ${scriptPath} --request-id ${requestId} (cwd: ${projectPath})`);
  
  const child = spawn(pythonPath, [scriptPath, '--request-id', requestId], {
    cwd: projectPath,
    detached: true,
    stdio: 'ignore', // Let it run independently
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    },
  });
  
  child.on('error', async (err) => {
    console.error(`Failed to start child process for request ${requestId}:`, err);
    try {
      // ONLY update the request status to FAILED if the process failed to start (e.g. file not found, bad interpreter)
      // This avoids race conditions as Python hasn't started and won't write to DB.
      await query(
        "UPDATE dbo.TBL_USER_REQUEST SET strStatus = 'FAILED', strErrorMessage = @error, dtCompletedAt = SYSUTCDATETIME() WHERE intId = @id AND strStatus = 'PENDING'",
        [
          { name: 'error', type: sql.NVarChar(sql.MAX), value: `Failed to start Python process: ${err.message}` },
          { name: 'id', type: sql.UniqueIdentifier(), value: requestId },
        ]
      );
    } catch (dbErr) {
      console.error(`Failed to update DB after spawn error for request ${requestId}:`, dbErr);
    }
  });
  
  child.unref(); // Allow Node parent process to continue without waiting
}
