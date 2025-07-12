# Migration to Pure Kysely

This document outlines the migration from Prisma + prisma-kysely to pure Kysely with kysely-codegen.

## Why Pure Kysely?

- **Clean types**: No more `ColumnType` wrapper issues
- **Full SQL control**: Write complex queries with full SQL power
- **Type-safe**: Compile-time query validation
- **Migrations**: Kysely now supports migrations
- **Lightweight**: Smaller bundle size

## What Changed

### 1. **Removed Prisma Dependencies**

- Removed `@prisma/client` and `prisma` packages
- Removed `prisma-kysely` generator
- Deleted `prisma/schema.prisma`

### 2. **Added Pure Kysely Setup**

- Added `kysely-codegen` for type generation
- Created `database/schema.sql` with SQL schema
- Created `kysely-codegen.json` configuration
- Updated database connection to use pure Kysely

### 3. **Updated Repository Layer**

- Fixed type imports to use generated Kysely types
- Updated column names to use snake_case (database convention)
- Simplified transform functions (no more `ColumnType` unwrapping)

## Setup Instructions

### 1. **Install Dependencies**

```bash
pnpm install
```

### 2. **Set Up Database**

```bash
# Start PostgreSQL (if using Docker)
docker compose -f docker-compose.db.yaml up -d

# Set up database schema and generate types
pnpm db:setup
```

### 3. **Verify Setup**

```bash
# Test database connection
pnpm dev
```

## Database Schema

The schema is now defined using Kysely migrations in `src/infrastructure/database/migrations/`:

```typescript
// Example migration: 001_initial_schema.ts
export async function up(db: Kysely<Database>): Promise<void> {
    // Create users table
    await db.schema
        .createTable("users")
        .addColumn("id", "varchar(255)", col => col.primaryKey())
        .addColumn("username", "varchar(255)", col => col.notNull())
        .addColumn("display_name", "varchar(255)")
        .addColumn("avatar", "text")
        .addColumn("is_bot", "boolean", col => col.notNull().defaultTo(false))
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn("updated_at", "timestamp", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Add indexes...
}
```

## Migrations

Database schema is managed using Kysely migrations:

```bash
# Run migrations
pnpm db:migrate

# Rollback migrations
pnpm db:migrate:rollback

# Create new migration
pnpm create-migration <migration_name>

# Generate types from database
pnpm db:generate
```

Generated types are available at `generated/database/index.ts`.

## Repository Pattern

The repository pattern now works with clean types:

```typescript
// Transform database user to domain user (snake_case -> camelCase)
const transformUser = (dbUser: Database["users"]): User => {
    return {
        id: dbUser.id,
        username: dbUser.username,
        ...(dbUser.display_name && { displayName: dbUser.display_name }),
        ...(dbUser.avatar && { avatar: dbUser.avatar }),
        isBot: dbUser.is_bot,
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
    };
};
```

## Benefits Achieved

1. **✅ No more `ColumnType` wrapper issues**
2. **✅ Clean, straightforward types**
3. **✅ Full SQL control when needed**
4. **✅ Type-safe queries**
5. **✅ Simpler repository implementations**
6. **✅ Better developer experience**

## Next Steps

1. **Update other repositories** as needed
2. **Add more complex queries** using Kysely's SQL builder
3. **Set up migrations** for production deployments
4. **Add database seeding** scripts

## Troubleshooting

### Type Generation Issues

```bash
# Regenerate types
pnpm db:generate

# Check kysely-codegen configuration
cat kysely-codegen.json
```

### Database Connection Issues

```bash
# Test connection
pnpm db:setup

# Check environment variables
echo $DATABASE_URL
```

### Import Path Issues

Make sure generated types are imported correctly:

```typescript
import type { Database } from "@db/index.js";
```
