import type { Kysely } from 'kysely';

import type { DB } from '../../../generated/database/types.js';
import type { ApiVersionConfiguration } from '../../../infrastructure/http/api/types.js';
import { createGuildRoutes } from './guilds.js';
import { createHealthRoutes } from './health.js';

/**
 * API v1 route configuration
 * This defines the application's routing contracts by organizing routes by feature
 */
export const createV1ApiConfiguration = (db: Kysely<DB>): ApiVersionConfiguration => ({
  config: {
    version: 'v1',
    basePath: '/api/v1',
  },
  groups: [createGuildRoutes(db), createHealthRoutes()],
});
