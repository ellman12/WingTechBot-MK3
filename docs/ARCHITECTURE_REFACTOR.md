# Architecture Refactoring: Moving Domain Entities to Core Layer

## 🎯 Problem Statement

The original architecture had domain entities defined in the `@wingtechbot-mk3/types` package, which violated several important architectural principles:

### Issues with Original Architecture

1. **❌ Violated Hexagonal Architecture**: Domain entities were in a shared package instead of the core layer
2. **❌ Wrong Dependency Direction**: Core layer depended on types package instead of the other way around
3. **❌ Mixed Concerns**: Types package contained both API contracts and domain entities
4. **❌ Business Logic Leakage**: Domain validation was in the types package instead of core
5. **❌ Poor Testability**: Domain logic was coupled to external package

## ✅ Solution: Proper Hexagonal Architecture

### New Architecture Overview

```
packages/
├── core/                    # 🎯 Domain Layer (Pure Business Logic)
│   ├── entities/           # Domain entities with business rules
│   │   ├── User.ts        # User domain entity
│   │   └── Command.ts     # Command domain entity
│   └── repositories/      # Repository interfaces (ports)
│       ├── UserRepository.ts
│       └── CommandRepository.ts
├── types/                  # 📋 API Contracts (DTOs & Validation)
│   └── api/v1/            # API request/response contracts
│       ├── users.ts       # User API contracts
│       └── commands.ts    # Command API contracts
├── backend/               # 🏗️ Application & Infrastructure
│   └── src/
│       ├── core/          # Local domain entities (for now)
│       ├── application/   # Use cases & orchestration
│       ├── adapters/      # HTTP controllers & repositories
│       └── infrastructure/ # Framework code
└── frontend/              # 🎨 UI Layer
```

### Key Changes Made

#### 1. **Created Domain Entities in Core Layer**

```typescript
// packages/backend/src/core/entities/User.ts
export interface User {
  readonly id: string;
  readonly username: string;
  readonly displayName?: string;
  readonly avatar?: string;
  readonly isBot: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class UserEntity {
  static create(data: CreateUserData): User {
    // Business validation logic here
    if (!data.id?.trim()) {
      throw new Error('User ID is required');
    }
    // ... more validation
  }

  // Domain logic methods
  isActive(): boolean {
    return !this.data.isBot;
  }

  getDisplayName(): string {
    return this.data.displayName || this.data.username;
  }
}
```

#### 2. **Updated Repository Interfaces**

```typescript
// packages/backend/src/core/repositories/UserRepository.ts
import type { User, CreateUserData, UpdateUserData } from '../entities/User.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User | null>;
  // ... other methods
}
```

#### 3. **Created API Contracts in Types Package**

```typescript
// packages/types/src/api/v1/users.ts
export const CreateUserRequestSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  username: z.string().min(1, 'Username is required'),
  displayName: z.string().optional(),
  avatar: z.string().optional(),
  isBot: z.boolean().default(false),
});

// Transformation functions
export const userToResponse = (user: User): UserResponse => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  avatar: user.avatar,
  isBot: user.isBot,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
```

#### 4. **Created Core Package for Sharing**

```typescript
// packages/core/src/entities/User.ts
// Same domain entities, but in a separate package for sharing
```

## 🔄 Dependency Flow

### Before (❌ Wrong)
```
Backend Core → Types Package (Domain Entities)
Types Package → API Contracts
```

### After (✅ Correct)
```
Types Package → Core Package (Domain Entities)
Backend Core → Core Package (Domain Entities)
Backend Adapters → Types Package (API Contracts)
```

## 🎯 Benefits of New Architecture

### 1. **Proper Hexagonal Architecture**
- Domain entities are in the innermost layer
- No external dependencies in core layer
- Clear separation of concerns

### 2. **Better Testability**
- Domain logic can be tested independently
- No need to mock external packages
- Pure business logic testing

### 3. **Improved Maintainability**
- Business rules are centralized in domain entities
- API contracts are separate from domain logic
- Clear boundaries between layers

### 4. **Type Safety**
- Full TypeScript support across all layers
- Runtime validation at API boundaries
- Compile-time type checking

### 5. **Flexibility**
- Easy to swap implementations
- Framework-independent domain logic
- Clear upgrade paths

## 📋 Usage Examples

### Backend Controller (Adapter Layer)

```typescript
import { validateCreateUserRequest, userToResponse } from '@wingtechbot-mk3/types';
import { UserEntity } from '../core/entities/User.js';

export const createUserHandler = async (req: Request, res: Response) => {
  try {
    // 1. Validate API request
    const apiRequest = validateCreateUserRequest(req.body);
    
    // 2. Convert to domain data
    const domainData = {
      id: apiRequest.id,
      username: apiRequest.username,
      displayName: apiRequest.displayName,
      avatar: apiRequest.avatar,
      isBot: apiRequest.isBot,
    };
    
    // 3. Create domain entity with business validation
    const user = UserEntity.create(domainData);
    
    // 4. Save via repository
    const savedUser = await userRepository.create(user);
    
    // 5. Transform to API response
    const response = userToResponse(savedUser);
    res.json(response);
  } catch (error) {
    // Handle validation or business rule errors
  }
};
```

### Repository Implementation (Adapter Layer)

```typescript
import type { User, CreateUserData } from '../core/entities/User.js';

export class DatabaseUserRepository implements UserRepository {
  async create(data: CreateUserData): Promise<User> {
    // Use domain entity for validation
    const user = UserEntity.create(data);
    
    // Save to database
    await this.db.users.create(user);
    
    return user;
  }
}
```

## 🚀 Next Steps

### 1. **Build Core Package**
```bash
pnpm build:core
```

### 2. **Update Backend Dependencies**
Once the core package is built, update backend imports:
```typescript
// Change from:
import type { User } from '../core/entities/User.js';

// To:
import type { User } from '@wingtechbot-mk3/core/entities/User';
```

### 3. **Add More Domain Entities**
- Guild entity
- GuildMember entity
- Any other business entities

### 4. **Create Domain Services**
- UserService for complex user operations
- CommandService for command orchestration

### 5. **Add Domain Events**
- UserCreated event
- CommandExecuted event
- For future event-driven architecture

## 🎉 Summary

This refactoring successfully:

- ✅ **Moved domain entities to core layer** where they belong
- ✅ **Separated API contracts from domain logic**
- ✅ **Established proper dependency direction**
- ✅ **Improved testability and maintainability**
- ✅ **Created clear architectural boundaries**
- ✅ **Maintained type safety throughout**

The architecture now properly follows hexagonal architecture principles and provides a solid foundation for future development. 