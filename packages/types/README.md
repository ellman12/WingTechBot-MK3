# @wingtechbot-mk3/types

Shared TypeScript types and Zod schemas for WingTechBot MK3 API, providing type safety across frontend and backend.

## 📦 Installation

```bash
# From backend or frontend package
pnpm add @wingtechbot-mk3/types
```

## 🎯 Purpose

This package provides:

- **API contracts** with request/response validation
- **Type safety** across frontend and backend
- **Runtime validation** with Zod schemas
- **Transformation functions** between domain and API layers

## 📚 Usage

### Import API Types

```typescript
import { CreateUserRequest, UserResponse, userToResponse, validateCreateUserRequest } from "@wingtechbot-mk3/types";
```

### Backend Usage

```typescript
import { UserEntity } from "@wingtechbot-mk3/core/entities/User";
import { userToResponse, validateCreateUserRequest } from "@wingtechbot-mk3/types";

// In your controller
export const createUserHandler = (req: Request, res: Response) => {
    try {
        // Validate API request
        const apiRequest = validateCreateUserRequest(req.body);

        // Convert to domain data
        const domainData = { id: apiRequest.id, username: apiRequest.username, displayName: apiRequest.displayName, avatar: apiRequest.avatar, isBot: apiRequest.isBot };

        // Create domain entity
        const user = UserEntity.create(domainData);

        // Transform to API response
        const response = userToResponse(user);
        res.json(response);
    } catch (error) {
        // Handle validation error
    }
};
```

### Frontend Usage

```typescript
import type { CreateUserRequest, UserResponse } from "@wingtechbot-mk3/types";

// Type-safe API calls
const createUser = async (userData: CreateUserRequest): Promise<UserResponse> => {
    const response = await fetch("/api/v1/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userData) });

    const data: UserResponse = await response.json();
    return data;
};
```

## 🏗️ Structure

```
src/
├── common/           # Common API types
│   ├── api.ts       # Base API response types
│   └── error.ts     # Error types and HTTP status codes
├── api/            # API endpoint contracts
│   └── v1/         # Version 1 API contracts
│       ├── users.ts    # User API request/response types
│       ├── commands.ts # Command API request/response types
│       └── common.ts   # Common v1 API types
└── index.ts        # Main export file
```

## 🛡️ Type Safety Features

### Runtime Validation

All schemas provide runtime validation using Zod:

```typescript
import { CreateUserRequestSchema } from "@wingtechbot-mk3/types";

// Validates at runtime and provides TypeScript types
const result = CreateUserRequestSchema.parse(unknownData);
```

### API Response Types

Consistent response format across all endpoints:

```typescript
// Success response
type ApiSuccessResponse<T> = { success: true; data: T };

// Error response
type ApiErrorResponse = { success: false; error: string; details?: ValidationError[] };
```

### Transformation Functions

Convert between domain entities and API representations:

```typescript
import { userToResponse, usersToResponse } from '@wingtechbot-mk3/types';

// Single user transformation
const apiResponse = userToResponse(domainUser);

// Multiple users transformation
const apiResponse = usersToResponse(domainUsers);
```

## 🔌 Available API Contracts

### User API

- `CreateUserRequest` - User creation request
- `UpdateUserRequest` - User update request
- `UserResponse` - User API response
- `UsersResponse` - Multiple users response
- `validateCreateUserRequest()` - Request validation
- `userToResponse()` - Domain → API transformation

### Command API

- `CreateCommandRequest` - Command creation request
- `UpdateCommandRequest` - Command update request
- `CommandResponse` - Command API response
- `CommandsResponse` - Multiple commands response
- `validateCreateCommandRequest()` - Request validation
- `commandToResponse()` - Domain → API transformation

### Common Types

- `ApiResponse` - Base API response format
- `ApiErrorResponse` - Error response format
- `HttpStatus` - HTTP status code constants

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

1. **Use validation functions** for all external data
2. **Import types, not schemas** in frontend code (unless you need validation)
3. **Use transformation functions** to convert between domain and API layers
4. **Leverage TypeScript's type inference** with Zod
5. **Keep API contracts separate** from domain entities

### Example: Complete API Flow

```typescript
// 1. API Request Validation
const apiRequest = validateCreateUserRequest(req.body);

// 2. Convert to Domain Data
const domainData = { id: apiRequest.id, username: apiRequest.username, displayName: apiRequest.displayName, avatar: apiRequest.avatar, isBot: apiRequest.isBot };

// 3. Create Domain Entity
const user = UserEntity.create(domainData);

// 4. Save to Repository
const savedUser = await userRepository.create(user);

// 5. Transform to API Response
const response = userToResponse(savedUser);
res.json(response);
```

## 🔄 Versioning

This package follows semantic versioning:

- **Major**: Breaking changes to API contracts
- **Minor**: New API endpoints or non-breaking additions
- **Patch**: Bug fixes and documentation updates

## 🤝 Contributing

When adding new API contracts:

1. **Define request schemas** with proper validation
2. **Create response schemas** with consistent format
3. **Add transformation functions** for domain → API conversion
4. **Export from index files** for easy importing
5. **Update this README** with new contracts
6. **Ensure backward compatibility** when possible

## 🎯 Design Principles

- **API-First**: Contracts define the API interface
- **Type Safety**: Full TypeScript support with runtime validation
- **Transformation**: Clear separation between domain and API layers
- **Consistency**: Uniform response formats across all endpoints
- **Validation**: Runtime validation for all external data
