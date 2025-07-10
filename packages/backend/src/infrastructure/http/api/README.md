# Versioned API System

This directory contains the new versioned API system that replaces the clunky route registration in `ExpressApp.ts`. The system supports multiple API versions with proper type safety and automatic documentation generation.

## Architecture

The versioned API system follows hexagonal architecture principles with clear separation of concerns:

```
api/
├── types.ts                   # Core type definitions
├── VersionedApiRouter.ts      # Main router that handles all versions
├── VersionedRouteRegistry.ts  # Registry for tracking routes across versions
├── v1/                       # Version 1 API
│   ├── routes.ts             # Route configuration
│   ├── controllers.ts        # Request handlers with v1 transformations
│   └── schemas.ts            # v1-specific request/response schemas
├── v2/                       # Version 2 API (future)
│   ├── routes.ts
│   ├── controllers.ts
│   └── schemas.ts
└── index.ts                  # Main exports
```

## Key Features

- **Version Management**: Support for multiple API versions (v1, v2, etc.)
- **Type Safety**: Full TypeScript support with versioned schemas
- **Automatic Documentation**: OpenAPI/Swagger docs generated per version
- **Deprecation Support**: Mark versions or individual endpoints as deprecated
- **Clean Separation**: Each version has its own controllers, schemas, and routes
- **Backward Compatibility**: Old API routes continue to work

## Adding a New API Version

### 1. Create Version Directory Structure

```bash
mkdir -p src/infrastructure/http/api/v2
```

### 2. Define Schemas

Create `v2/schemas.ts`:

```typescript
import { z } from 'zod';

// v2 might have enhanced Guild schema with new fields
export const GuildV2Schema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  memberCount: z.number(),
  prefix: z.string(),
  isActive: z.boolean(),
  features: z.array(z.string()), // New in v2
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GuildV2 = z.infer<typeof GuildV2Schema>;
```

### 3. Create Controllers

Create `v2/controllers.ts`:

```typescript
import type { RequestHandler } from 'express';
import type { Kysely } from 'kysely';

import type { DB } from '../../../../generated/database/types.js';

// Transform domain entity to v2 API representation
const transformGuildToV2 = (guild: Guild): GuildV2 => ({
  // ... existing fields ...
  features: guild.features || [], // New field in v2
});

export const getGuildsV2Handler =
  (db: Kysely<DB>): RequestHandler =>
  async (_req, res) => {
    // Implementation with v2 transformations
  };
```

### 4. Configure Routes

Create `v2/routes.ts`:

```typescript
import type { ApiVersionConfiguration } from '../types.js';

export const createV2ApiConfiguration = (db: Kysely<DB>): ApiVersionConfiguration => ({
  config: {
    version: 'v2',
    basePath: '/api/v2',
  },
  groups: [
    {
      name: 'guilds',
      basePath: '/guilds',
      tags: ['Guilds'],
      routes: [
        // Define v2 routes here
      ],
    },
  ],
});
```

### 5. Register in Router

Update `VersionedApiRouter.ts`:

```typescript
import { createV2ApiConfiguration } from './v2/routes.js';

// In setupRoutes method:
const v2Config = createV2ApiConfiguration(this.db);
VersionedRouteRegistry.registerVersion(v2Config);
this.setupV2Routes(app);
```

## Deprecating API Versions

Mark a version as deprecated:

```typescript
export const createV1ApiConfiguration = (db: Kysely<DB>): ApiVersionConfiguration => ({
  config: {
    version: 'v1',
    basePath: '/api/v1',
    deprecated: true,
    deprecationDate: new Date('2024-01-01'),
    sunsetDate: new Date('2024-06-01'),
  },
  // ... rest of config
});
```

## Individual Route Deprecation

Mark specific routes as deprecated:

```typescript
{
  method: 'get',
  path: '/old-endpoint',
  summary: 'Legacy endpoint',
  tags: ['Legacy'],
  handler: legacyHandler(db),
  deprecated: true, // This endpoint is deprecated
}
```

## Documentation

The system automatically generates:

- Version-specific Swagger UI: `/api/docs/v1`, `/api/docs/v2`
- Version-specific OpenAPI specs: `/api/docs/v1/openapi.json`
- Overview of all versions: `/api/docs`

## Migration from Old System

The old `ApiRoute.ts` system is deprecated but still available for backward compatibility. To migrate:

1. Move route definitions to version-specific files
2. Create controllers with proper transformations
3. Define versioned schemas
4. Remove old route registration from `ExpressApp.ts`

## Benefits

- **Maintainability**: Clear organization of API versions
- **Type Safety**: Versioned schemas prevent breaking changes
- **Documentation**: Automatic generation for each version
- **Flexibility**: Easy to add new versions or deprecate old ones
- **Clean Code**: ExpressApp.ts is no longer cluttered with route definitions
