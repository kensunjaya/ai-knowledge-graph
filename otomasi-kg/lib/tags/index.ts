import { secretQuery, sql } from '../database/secret-db';

export interface Tag {
  id: number;
  name: string;
}

export async function getAllTags(): Promise<Tag[]> {
  const res = await secretQuery(`
    SELECT
      Id AS id,
      Name AS name
    FROM TBL_TAGS
    ORDER BY Name ASC
  `);
  return res.recordset;
}

export async function createTag(name: string): Promise<Tag> {
  const res = await secretQuery(
    `
    INSERT INTO TBL_TAGS (Name)
    OUTPUT INSERTED.Id AS id, INSERTED.Name AS name
    VALUES (@name);
  `,
    [{ name: 'name', type: sql.NVarChar(50), value: name.trim() }]
  );
  return res.recordset[0];
}

export async function deleteTag(id: number): Promise<boolean> {
  const res = await secretQuery(
    `
    DELETE FROM TBL_TAGS WHERE Id = @id;
  `,
    [{ name: 'id', type: sql.Int(), value: id }]
  );
  return res.rowsAffected[0] > 0;
}
