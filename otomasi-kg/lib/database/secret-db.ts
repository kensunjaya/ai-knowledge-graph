import sql from 'mssql';

const secretDbConfig: sql.config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_SECRET_NAME || 'SecretManagerDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

let secretPool: sql.ConnectionPool | null = null;

export async function getSecretConnectionPool() {
  if (secretPool && secretPool.connected) return secretPool;

  if (secretPool) {
    try {
      await secretPool.close();
    } catch (e) {
      // Ignore closing error
    }
  }

  secretPool = new sql.ConnectionPool(secretDbConfig);
  await secretPool.connect();
  return secretPool;
}

export async function secretQuery(
  queryStr: string,
  params?: { name: string; type: sql.ISqlType; value: any }[]
) {
  const connPool = await getSecretConnectionPool();
  const req = connPool.request();
  if (params) {
    for (const p of params) {
      req.input(p.name, p.type, p.value);
    }
  }
  return req.query(queryStr);
}

export { sql };
