import type {
  CreateGuildData,
  Guild,
  UpdateGuildData,
} from '@wingtechbot-mk3/types/entities/guild';
import {
  validateCreateGuildData,
  validateUpdateGuildData,
} from '@wingtechbot-mk3/types/entities/guild';
import type { Kysely } from 'kysely';

import {
  createGuildInDb,
  deleteGuildFromDb,
  findAllGuilds,
  findGuildById,
  guildExists,
  updateGuildInDb,
} from '../../adapters/repositories/KyselyGuildRepository.js';
import type { DB } from '../../generated/database/types.js';
import { GuildNotFoundError } from '../errors/GuildErrors.js';

export const getGuildById = async (db: Kysely<DB>, id: string): Promise<Guild> => {
  const guild = await findGuildById(db, id);

  if (!guild) {
    throw new GuildNotFoundError(`Guild with id ${id} not found`);
  }

  return guild;
};

export const getAllGuilds = async (db: Kysely<DB>): Promise<Guild[]> => {
  return findAllGuilds(db);
};

export const createGuild = async (db: Kysely<DB>, data: CreateGuildData): Promise<Guild> => {
  const validatedData = validateCreateGuildData(data);

  const existingGuild = await guildExists(db, validatedData.id);

  if (existingGuild) {
    throw new Error(`Guild with id ${validatedData.id} already exists`);
  }

  return createGuildInDb(db, validatedData);
};

export const updateGuild = async (
  db: Kysely<DB>,
  id: string,
  data: UpdateGuildData
): Promise<Guild> => {
  const existingGuild = await guildExists(db, id);

  if (!existingGuild) {
    throw new GuildNotFoundError(`Guild with id ${id} not found`);
  }

  const validatedData = validateUpdateGuildData(data);

  const updatedGuild = await updateGuildInDb(db, id, validatedData);

  if (!updatedGuild) {
    throw new GuildNotFoundError(`Failed to update guild with id ${id}`);
  }

  return updatedGuild;
};

export const deleteGuild = async (db: Kysely<DB>, id: string): Promise<void> => {
  const existingGuild = await guildExists(db, id);

  if (!existingGuild) {
    throw new GuildNotFoundError(`Guild with id ${id} not found`);
  }

  const deleted = await deleteGuildFromDb(db, id);

  if (!deleted) {
    throw new Error(`Failed to delete guild with id ${id}`);
  }
};
