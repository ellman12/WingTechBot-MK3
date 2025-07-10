import type {
  CreateGuildData,
  Guild,
  UpdateGuildData,
} from '@wingtechbot-mk3/types/entities/guild';
import type { Kysely, Selectable } from 'kysely';

import type { DB } from '../../generated/database/types.js';

const mapToEntity = (row: Selectable<DB['guilds']>): Guild => ({
  id: row.id,
  name: row.name,
  ownerId: row.ownerId,
  memberCount: row.memberCount,
  prefix: row.prefix,
  isActive: row.isActive,
  createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
});
export const findGuildById = async (db: Kysely<DB>, id: string): Promise<Guild | null> => {
  const result = await db.selectFrom('guilds').selectAll().where('id', '=', id).executeTakeFirst();

  return result ? mapToEntity(result) : null;
};

export const findAllGuilds = async (db: Kysely<DB>): Promise<Guild[]> => {
  const results = await db.selectFrom('guilds').selectAll().execute();

  return results.map(mapToEntity);
};

export const findGuildsByOwnerId = async (db: Kysely<DB>, ownerId: string): Promise<Guild[]> => {
  const results = await db
    .selectFrom('guilds')
    .selectAll()
    .where('ownerId', '=', ownerId)
    .execute();

  return results.map(mapToEntity);
};

export const createGuildInDb = async (db: Kysely<DB>, data: CreateGuildData): Promise<Guild> => {
  const now = new Date().toISOString();
  const guildData = {
    id: data.id,
    name: data.name,
    ownerId: data.ownerId,
    memberCount: data.memberCount ?? 0,
    prefix: data.prefix ?? '!',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db
    .insertInto('guilds')
    .values(guildData)
    .returningAll()
    .executeTakeFirstOrThrow();

  return mapToEntity(result);
};

export const updateGuildInDb = async (
  db: Kysely<DB>,
  id: string,
  data: UpdateGuildData
): Promise<Guild | null> => {
  const updateData: Record<string, string | number | boolean> = {
    updatedAt: new Date().toISOString(),
  };

  // Copy string and number fields
  if (data.name !== undefined) updateData.name = data.name;
  if (data.memberCount !== undefined) updateData.memberCount = data.memberCount;
  if (data.prefix !== undefined) updateData.prefix = data.prefix;

  // Convert boolean to boolean (not number)
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  const result = await db
    .updateTable('guilds')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  return result ? mapToEntity(result) : null;
};

export const deleteGuildFromDb = async (db: Kysely<DB>, id: string): Promise<boolean> => {
  const result = await db.deleteFrom('guilds').where('id', '=', id).execute();

  return result.length > 0 && Number(result[0]?.numDeletedRows) > 0;
};

export const guildExists = async (db: Kysely<DB>, id: string): Promise<boolean> => {
  const result = await db.selectFrom('guilds').select('id').where('id', '=', id).executeTakeFirst();

  return result !== undefined;
};
