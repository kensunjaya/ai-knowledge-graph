import sql from 'mssql';

const config: sql.config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getConnectionPool() {
  if (pool && pool.connected) return pool;
  
  if (pool) {
    try {
      await pool.close();
    } catch (e) {
      // Ignore closing error
    }
  }
  
  pool = await sql.connect(config);
  return pool;
}

export async function query(queryStr: string, params?: { name: string; type: sql.ISqlType; value: any }[]) {
  const connPool = await getConnectionPool();
  const req = connPool.request();
  if (params) {
    for (const p of params) {
      req.input(p.name, p.type, p.value);
    }
  }
  return req.query(queryStr);
}

export async function executeProc(procName: string, params?: { name: string; type: sql.ISqlType; value: any }[]) {
  const connPool = await getConnectionPool();
  const req = connPool.request();
  if (params) {
    for (const p of params) {
      req.input(p.name, p.type, p.value);
    }
  }
  return req.execute(procName);
}

export { sql };
