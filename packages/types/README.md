# @wingtechbot-mk3/types

Shared TypeScript types and Zod schemas for WingTechBot MK3 API, providing type safety across frontend and backend.

## 📦 Installation

```bash
# From backend or frontend package
pnpm add @wingtechbot-mk3/types
```

## 🎯 Purpose

This package provides:

- **Runtime validation** with Zod schemas
- **Type safety** across frontend and backend
- **Consistent API contracts** between services
- **Auto-complete** and IntelliSense support

## 📚 Usage

### Import Types

```typescript
import {
  ApiErrorResponse,
  CreateGuildData,
  GetGuildsResponse,
  Guild,
} from '@wingtechbot-mk3/types';
```

### Backend Usage

```typescript
import { validateCreateGuildData } from '@wingtechbot-mk3/types';

// In your controller
export const createGuildHandler = (req: Request, res: Response) => {
  try {
    const guildData = validateCreateGuildData(req.body);
    // guildData is now type-safe and validated
  } catch (error) {
    // Handle validation error
  }
};
```

### Frontend Usage

```typescript
import type { GetGuildsResponse, Guild } from '@wingtechbot-mk3/types';

// Type-safe API calls
const fetchGuilds = async (): Promise<Guild[]> => {
  const response = await fetch('/api/v1/guilds');
  const data: GetGuildsResponse = await response.json();
  return data.data;
};
```

## 🏗️ Structure

```
src/
├── common/           # Common API types
│   ├── api.ts       # Base API response types
│   └── error.ts     # Error types and HTTP status codes
├── entities/        # Domain entity types
│   ├── guild.ts     # Guild entity and validation
│   ├── user.ts      # User entity and validation
│   ├── guildMember.ts
│   └── command.ts
├── api/            # API endpoint types
│   ├── guild.ts    # Guild API request/response types
│   └── user.ts     # User API request/response types
└── index.ts        # Main export file
```

## 🛡️ Type Safety Features

### Runtime Validation

All schemas provide runtime validation using Zod:

```typescript
import { CreateGuildDataSchema } from '@wingtechbot-mk3/types';

// Validates at runtime and provides TypeScript types
const result = CreateGuildDataSchema.parse(unknownData);
```

### API Response Types

Consistent response format across all endpoints:

```typescript
// Success response
type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

// Error response
type ApiErrorResponse = {
  success: false;
  error: string;
  details?: ValidationError[];
};
```

### Entity Validation

Each entity has comprehensive validation rules:

```typescript
// Guild validation
const GuildSchema = z.object({
  id: z.string().min(1, 'Guild ID is required'),
  name: z.string().min(1, 'Guild name is required'),
  ownerId: z.string().min(1, 'Guild owner ID is required'),
  memberCount: z.number().int().min(0, 'Member count must be non-negative'),
  prefix: z
    .string()
    .max(5, 'Guild prefix cannot be longer than 5 characters')
    .regex(/^\S+$/, 'Guild prefix cannot contain spaces'),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
```

## 🔌 Available Types

### Entities

- `Guild` - Discord server information
- `User` - Discord user information
- `GuildMember` - User membership in guilds
- `Command` - Command execution history

### API Types

- Guild endpoints: `GetGuildsResponse`, `CreateGuildRequest`, etc.
- User endpoints: `GetUsersResponse`, `CreateUserRequest`, etc.
- Common: `ApiResponse`, `ApiErrorResponse`, `HealthCheckResponse`

### Error Types

- `GuildNotFoundError`
- `UserNotFoundError`
- `ValidationFailedError`
- `ConflictError`
- `HTTP_STATUS` constants

## 🚀 Development

### Build

```bash
pnpm build
```

### Development Mode

```bash
pnpm dev  # Watch mode
```

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Formatting

```bash
pnpm format
pnpm format:check
```

## 📋 Best Practices

1. **Always use validation functions** for external data
2. **Import types, not schemas** in frontend code (unless you need validation)
3. **Use discriminated unions** for API responses
4. **Leverage TypeScript's type inference** with Zod

### Example: Type-safe API Client

```typescript
import type {
  ApiErrorResponse,
  CreateGuildRequest,
  CreateGuildResponse,
  GetGuildsResponse,
  Guild,
} from '@wingtechbot-mk3/types';

class GuildApiClient {
  async getGuilds(): Promise<Guild[]> {
    const response = await fetch('/api/v1/guilds');
    const data: GetGuildsResponse | ApiErrorResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    return data.data;
  }

  async createGuild(guild: CreateGuildRequest): Promise<Guild> {
    const response = await fetch('/api/v1/guilds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guild),
    });

    const data: CreateGuildResponse | ApiErrorResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    return data.data;
  }
}
```

## 🔄 Versioning

This package follows semantic versioning:

- **Major**: Breaking changes to type definitions
- **Minor**: New types or non-breaking additions
- **Patch**: Bug fixes and documentation updates

## 🤝 Contributing

When adding new types:

1. **Add entity schemas** in `entities/` with full validation
2. **Create API types** in `api/` for request/response shapes
3. **Export from index.ts** for easy importing
4. **Update this README** with new types
5. **Ensure backward compatibility** when possible
