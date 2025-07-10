import {
  ApiMessageResponseSchema,
  ApiSuccessResponseSchema,
} from '@wingtechbot-mk3/types/api/v1/common';
import {
  CreateGuildRequestSchema,
  GuildParamsSchema,
  GuildSchema,
  UpdateGuildRequestSchema,
} from '@wingtechbot-mk3/types/api/v1/guilds';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import {
  createGuildV1Handler,
  deleteGuildV1Handler,
  getGuildByIdV1Handler,
  getGuildsV1Handler,
  updateGuildV1Handler,
} from '../../../adapters/http/v1/controllers/GuildController.js';
import type { DB } from '../../../generated/database/types.js';
import type { RouteGroup } from '../../../infrastructure/http/api/types.js';

// Response schemas for guild endpoints
const GetGuildsV1ResponseSchema = ApiSuccessResponseSchema(z.array(GuildSchema));
const GetGuildV1ResponseSchema = ApiSuccessResponseSchema(GuildSchema);
const CreateGuildV1ResponseSchema = ApiSuccessResponseSchema(GuildSchema);
const UpdateGuildV1ResponseSchema = ApiSuccessResponseSchema(GuildSchema);
const DeleteGuildV1ResponseSchema = ApiMessageResponseSchema;

/**
 * Guild routes configuration for API v1
 */
export const createGuildRoutes = (db: Kysely<DB>): RouteGroup => ({
  name: 'guilds',
  basePath: '/guilds',
  tags: ['Guilds'],
  routes: [
    {
      method: 'get',
      path: '',
      summary: 'Get all guilds',
      description: 'Retrieve a list of all Discord guilds',
      tags: ['Guilds'],
      handler: getGuildsV1Handler(db),
      responseSchema: GetGuildsV1ResponseSchema,
    },
    {
      method: 'get',
      path: '/{id}',
      summary: 'Get guild by ID',
      description: 'Retrieve a specific Discord guild by its ID',
      tags: ['Guilds'],
      handler: getGuildByIdV1Handler(db),
      paramsSchema: GuildParamsSchema,
      responseSchema: GetGuildV1ResponseSchema,
    },
    {
      method: 'post',
      path: '',
      summary: 'Create a new guild',
      description: 'Create a new Discord guild entry',
      tags: ['Guilds'],
      handler: createGuildV1Handler(db),
      requestSchema: CreateGuildRequestSchema,
      responseSchema: CreateGuildV1ResponseSchema,
    },
    {
      method: 'put',
      path: '/{id}',
      summary: 'Update a guild',
      description: 'Update an existing Discord guild',
      tags: ['Guilds'],
      handler: updateGuildV1Handler(db),
      paramsSchema: GuildParamsSchema,
      requestSchema: UpdateGuildRequestSchema,
      responseSchema: UpdateGuildV1ResponseSchema,
    },
    {
      method: 'delete',
      path: '/{id}',
      summary: 'Delete a guild',
      description: 'Remove a Discord guild entry',
      tags: ['Guilds'],
      handler: deleteGuildV1Handler(db),
      paramsSchema: GuildParamsSchema,
      responseSchema: DeleteGuildV1ResponseSchema,
    },
  ],
});
