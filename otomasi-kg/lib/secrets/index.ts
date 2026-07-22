import crypto from 'crypto';
import { secretQuery, sql } from '../database/secret-db';

export interface SecretMetadata {
  id: string;
  providerId: number;
  providerName: string | null;
  providerCategory: string | null;
  providerIconSvg: string | null;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RawSecretRecord {
  id: string;
  providerId: number;
  name: string;
  description: string | null;
  encryptedValue: Buffer;
  salt: Buffer;
  nonce: Buffer;
  version: number;
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getAllSecretsMetadata(): Promise<SecretMetadata[]> {
  const res = await secretQuery(`
    SELECT
      s.Id AS id,
      s.ProviderId AS providerId,
      p.Name AS providerName,
      p.Category AS providerCategory,
      p.IconSvg AS providerIconSvg,
      s.Name AS name,
      s.Description AS description,
      s.Version AS version,
      s.IsActive AS isActive,
      s.ExpiresAt AS expiresAt,
      s.LastUsedAt AS lastUsedAt,
      s.CreatedAt AS createdAt,
      s.UpdatedAt AS updatedAt
    FROM TBL_SECRETS s
    LEFT JOIN TBL_PROVIDERS p ON s.ProviderId = p.Id
    ORDER BY s.Name ASC
  `);
  return res.recordset;
}

export async function getRawSecretByIdentifier(identifier: string): Promise<RawSecretRecord | null> {
  const isGuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);

  let queryStr = `
    SELECT
      Id AS id,
      ProviderId AS providerId,
      Name AS name,
      Description AS description,
      EncryptedValue AS encryptedValue,
      Salt AS salt,
      Nonce AS nonce,
      Version AS version,
      IsActive AS isActive,
      ExpiresAt AS expiresAt,
      LastUsedAt AS lastUsedAt,
      CreatedAt AS createdAt,
      UpdatedAt AS updatedAt
    FROM TBL_SECRETS
  `;

  let params: { name: string; type: sql.ISqlType; value: any }[] = [];

  if (isGuid) {
    queryStr += ` WHERE Id = @id`;
    params.push({ name: 'id', type: sql.UniqueIdentifier(), value: identifier });
  } else {
    queryStr += ` WHERE Name = @name`;
    params.push({ name: 'name', type: sql.NVarChar(100), value: identifier });
  }

  const res = await secretQuery(queryStr, params);
  return res.recordset[0] || null;
}

export async function createSecret(data: {
  name: string;
  providerId: number;
  description?: string | null;
  encryptedValue: Buffer;
  salt: Buffer;
  nonce: Buffer;
  isActive?: boolean;
  expiresAt?: string | null;
}): Promise<SecretMetadata> {
  const newId = crypto.randomUUID();
  const isActive = data.isActive !== undefined ? data.isActive : true;

  await secretQuery(
    `
    INSERT INTO TBL_SECRETS (
      Id, ProviderId, Name, Description, EncryptedValue, Salt, Nonce,
      Version, IsActive, ExpiresAt, LastUsedAt, CreatedAt, UpdatedAt
    )
    VALUES (
      @id, @providerId, @name, @description, @encryptedValue, @salt, @nonce,
      1, @isActive, @expiresAt, NULL, SYSUTCDATETIME(), SYSUTCDATETIME()
    )
  `,
    [
      { name: 'id', type: sql.UniqueIdentifier(), value: newId },
      { name: 'providerId', type: sql.Int(), value: data.providerId },
      { name: 'name', type: sql.NVarChar(100), value: data.name.trim() },
      { name: 'description', type: sql.NVarChar(500), value: data.description || null },
      { name: 'encryptedValue', type: sql.VarBinary(sql.MAX), value: data.encryptedValue },
      { name: 'salt', type: sql.VarBinary(32), value: data.salt },
      { name: 'nonce', type: sql.VarBinary(12), value: data.nonce },
      { name: 'isActive', type: sql.Bit(), value: isActive },
      { name: 'expiresAt', type: sql.DateTime2(), value: data.expiresAt ? new Date(data.expiresAt) : null },
    ]
  );

  const res = await secretQuery(
    `
    SELECT
      s.Id AS id,
      s.ProviderId AS providerId,
      p.Name AS providerName,
      p.Category AS providerCategory,
      p.IconSvg AS providerIconSvg,
      s.Name AS name,
      s.Description AS description,
      s.Version AS version,
      s.IsActive AS isActive,
      s.ExpiresAt AS expiresAt,
      s.LastUsedAt AS lastUsedAt,
      s.CreatedAt AS createdAt,
      s.UpdatedAt AS updatedAt
    FROM TBL_SECRETS s
    LEFT JOIN TBL_PROVIDERS p ON s.ProviderId = p.Id
    WHERE s.Id = @id
  `,
    [{ name: 'id', type: sql.UniqueIdentifier(), value: newId }]
  );

  return res.recordset[0];
}

export async function updateSecret(
  id: string,
  data: {
    name: string;
    providerId: number;
    description?: string | null;
    encryptedValue?: Buffer;
    salt?: Buffer;
    nonce?: Buffer;
    isActive?: boolean;
    expiresAt?: string | null;
  }
): Promise<SecretMetadata | null> {
  const existing = await getRawSecretByIdentifier(id);
  if (!existing) return null;

  const newVersion = data.encryptedValue ? existing.version + 1 : existing.version;
  const encryptedValue = data.encryptedValue || existing.encryptedValue;
  const salt = data.salt || existing.salt;
  const nonce = data.nonce || existing.nonce;
  const isActive = data.isActive !== undefined ? data.isActive : existing.isActive;

  await secretQuery(
    `
    UPDATE TBL_SECRETS
    SET
      ProviderId = @providerId,
      Name = @name,
      Description = @description,
      EncryptedValue = @encryptedValue,
      Salt = @salt,
      Nonce = @nonce,
      Version = @version,
      IsActive = @isActive,
      ExpiresAt = @expiresAt,
      UpdatedAt = SYSUTCDATETIME()
    WHERE Id = @id
  `,
    [
      { name: 'id', type: sql.UniqueIdentifier(), value: id },
      { name: 'providerId', type: sql.Int(), value: data.providerId },
      { name: 'name', type: sql.NVarChar(100), value: data.name.trim() },
      { name: 'description', type: sql.NVarChar(500), value: data.description || null },
      { name: 'encryptedValue', type: sql.VarBinary(sql.MAX), value: encryptedValue },
      { name: 'salt', type: sql.VarBinary(32), value: salt },
      { name: 'nonce', type: sql.VarBinary(12), value: nonce },
      { name: 'version', type: sql.Int(), value: newVersion },
      { name: 'isActive', type: sql.Bit(), value: isActive },
      { name: 'expiresAt', type: sql.DateTime2(), value: data.expiresAt ? new Date(data.expiresAt) : null },
    ]
  );

  const res = await secretQuery(
    `
    SELECT
      s.Id AS id,
      s.ProviderId AS providerId,
      p.Name AS providerName,
      p.Category AS providerCategory,
      p.IconSvg AS providerIconSvg,
      s.Name AS name,
      s.Description AS description,
      s.Version AS version,
      s.IsActive AS isActive,
      s.ExpiresAt AS expiresAt,
      s.LastUsedAt AS lastUsedAt,
      s.CreatedAt AS createdAt,
      s.UpdatedAt AS updatedAt
    FROM TBL_SECRETS s
    LEFT JOIN TBL_PROVIDERS p ON s.ProviderId = p.Id
    WHERE s.Id = @id
  `,
    [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
  );

  return res.recordset[0] || null;
}

export async function deleteSecret(id: string): Promise<boolean> {
  const res = await secretQuery(
    `DELETE FROM TBL_SECRETS WHERE Id = @id`,
    [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
  );
  return res.rowsAffected[0] > 0;
}

export async function updateSecretLastUsed(id: string): Promise<void> {
  await secretQuery(
    `UPDATE TBL_SECRETS SET LastUsedAt = SYSUTCDATETIME() WHERE Id = @id`,
    [{ name: 'id', type: sql.UniqueIdentifier(), value: id }]
  );
}
