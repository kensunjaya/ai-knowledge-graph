import { secretQuery, sql } from '../database/secret-db';

export interface Provider {
  id: number;
  name: string;
  category: string | null;
  baseUrl: string | null;
  description: string | null;
  iconSvg: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getAllProviders(): Promise<Provider[]> {
  const res = await secretQuery(`
    SELECT
      Id AS id,
      Name AS name,
      Category AS category,
      BaseUrl AS baseUrl,
      Description AS description,
      IconSvg AS iconSvg,
      CreatedAt AS createdAt,
      UpdatedAt AS updatedAt
    FROM TBL_PROVIDERS
    ORDER BY Name ASC
  `);
  return res.recordset;
}

export async function getProviderById(id: number): Promise<Provider | null> {
  const res = await secretQuery(
    `
    SELECT
      Id AS id,
      Name AS name,
      Category AS category,
      BaseUrl AS baseUrl,
      Description AS description,
      IconSvg AS iconSvg,
      CreatedAt AS createdAt,
      UpdatedAt AS updatedAt
    FROM TBL_PROVIDERS
    WHERE Id = @id
  `,
    [{ name: 'id', type: sql.Int(), value: id }]
  );
  return res.recordset[0] || null;
}

export async function createProvider(data: {
  name: string;
  category?: string | null;
  baseUrl?: string | null;
  description?: string | null;
  iconSvg?: string | null;
}): Promise<Provider> {
  const res = await secretQuery(
    `
    INSERT INTO TBL_PROVIDERS (Name, Category, BaseUrl, Description, IconSvg, CreatedAt, UpdatedAt)
    OUTPUT
      INSERTED.Id AS id,
      INSERTED.Name AS name,
      INSERTED.Category AS category,
      INSERTED.BaseUrl AS baseUrl,
      INSERTED.Description AS description,
      INSERTED.IconSvg AS iconSvg,
      INSERTED.CreatedAt AS createdAt,
      INSERTED.UpdatedAt AS updatedAt
    VALUES (@name, @category, @baseUrl, @description, @iconSvg, SYSUTCDATETIME(), SYSUTCDATETIME());
  `,
    [
      { name: 'name', type: sql.NVarChar(100), value: data.name },
      { name: 'category', type: sql.NVarChar(50), value: data.category || null },
      { name: 'baseUrl', type: sql.NVarChar(255), value: data.baseUrl || null },
      { name: 'description', type: sql.NVarChar(500), value: data.description || null },
      { name: 'iconSvg', type: sql.NVarChar(sql.MAX), value: data.iconSvg || null },
    ]
  );
  return res.recordset[0];
}

export async function updateProvider(
  id: number,
  data: {
    name: string;
    category?: string | null;
    baseUrl?: string | null;
    description?: string | null;
    iconSvg?: string | null;
  }
): Promise<Provider | null> {
  const res = await secretQuery(
    `
    UPDATE TBL_PROVIDERS
    SET
      Name = @name,
      Category = @category,
      BaseUrl = @baseUrl,
      Description = @description,
      IconSvg = @iconSvg,
      UpdatedAt = SYSUTCDATETIME()
    OUTPUT
      INSERTED.Id AS id,
      INSERTED.Name AS name,
      INSERTED.Category AS category,
      INSERTED.BaseUrl AS baseUrl,
      INSERTED.Description AS description,
      INSERTED.IconSvg AS iconSvg,
      INSERTED.CreatedAt AS createdAt,
      INSERTED.UpdatedAt AS updatedAt
    WHERE Id = @id;
  `,
    [
      { name: 'id', type: sql.Int(), value: id },
      { name: 'name', type: sql.NVarChar(100), value: data.name },
      { name: 'category', type: sql.NVarChar(50), value: data.category || null },
      { name: 'baseUrl', type: sql.NVarChar(255), value: data.baseUrl || null },
      { name: 'description', type: sql.NVarChar(500), value: data.description || null },
      { name: 'iconSvg', type: sql.NVarChar(sql.MAX), value: data.iconSvg || null },
    ]
  );
  return res.recordset[0] || null;
}

export async function deleteProvider(id: number): Promise<boolean> {
  const res = await secretQuery(
    `
    DELETE FROM TBL_PROVIDERS WHERE Id = @id;
  `,
    [{ name: 'id', type: sql.Int(), value: id }]
  );
  return res.rowsAffected[0] > 0;
}
