# Database Guide

This guide covers database schema, migrations, and operations for WingTechBot MK3.

## 🗄️ Database Overview

WingTechBot MK3 uses PostgreSQL as its primary database with:

- **Prisma** for schema management and migrations
- **Kysely** for type-safe query building
- **Connection pooling** for performance
- **Automated migrations** in CI/CD

## 🏗️ Schema Design

### Core Tables

#### Guilds Table

```sql
CREATE TABLE guilds (
    id VARCHAR(20) PRIMARY KEY,           -- Discord guild ID
    name VARCHAR(255) NOT NULL,           -- Guild name
    owner_id VARCHAR(20) NOT NULL,        -- Guild owner Discord ID
    member_count INTEGER DEFAULT 0,       -- Current member count
    is_active BOOLEAN DEFAULT TRUE,       -- Whether guild is active
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_guilds_owner_id ON guilds(owner_id);
CREATE INDEX idx_guilds_is_active ON guilds(is_active);
CREATE INDEX idx_guilds_created_at ON guilds(created_at);
```

#### Users Table

```sql
CREATE TABLE users (
    id VARCHAR(20) PRIMARY KEY,           -- Discord user ID
    username VARCHAR(255) NOT NULL,       -- Discord username
    discriminator VARCHAR(4),             -- Discord discriminator (legacy)
    global_name VARCHAR(255),             -- Discord display name
    avatar_url TEXT,                      -- Avatar URL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### Guild Members Table

```sql
CREATE TABLE guild_members (
    guild_id VARCHAR(20) REFERENCES guilds(id) ON DELETE CASCADE,
    user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    roles JSONB DEFAULT '[]',             -- Array of role IDs
    nickname VARCHAR(255),                -- Guild-specific nickname
    PRIMARY KEY (guild_id, user_id)
);

-- Indexes
CREATE INDEX idx_guild_members_guild_id ON guild_members(guild_id);
CREATE INDEX idx_guild_members_user_id ON guild_members(user_id);
CREATE INDEX idx_guild_members_joined_at ON guild_members(joined_at);
```

### Prisma Schema

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

generator kysely {
  provider = "prisma-kysely"
  output   = "../src/generated/database"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Guild {
  id          String   @id @db.VarChar(20)
  name        String   @db.VarChar(255)
  ownerId     String   @map("owner_id") @db.VarChar(20)
  memberCount Int      @default(0) @map("member_count")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  members GuildMember[]

  @@index([ownerId], map: "idx_guilds_owner_id")
  @@index([isActive], map: "idx_guilds_is_active")
  @@index([createdAt], map: "idx_guilds_created_at")
  @@map("guilds")
}

model User {
  id            String   @id @db.VarChar(20)
  username      String   @db.VarChar(255)
  discriminator String?  @db.VarChar(4)
  globalName    String?  @map("global_name") @db.VarChar(255)
  avatarUrl     String?  @map("avatar_url")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  guilds GuildMember[]

  @@index([username], map: "idx_users_username")
  @@index([createdAt], map: "idx_users_created_at")
  @@map("users")
}

model GuildMember {
  guildId  String   @map("guild_id") @db.VarChar(20)
  userId   String   @map("user_id") @db.VarChar(20)
  joinedAt DateTime @default(now()) @map("joined_at")
  roles    Json     @default("[]")
  nickname String?  @db.VarChar(255)

  // Relations
  guild Guild @relation(fields: [guildId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([guildId, userId])
  @@index([guildId], map: "idx_guild_members_guild_id")
  @@index([userId], map: "idx_guild_members_user_id")
  @@index([joinedAt], map: "idx_guild_members_joined_at")
  @@map("guild_members")
}
```

## 🚀 Database Operations

### Development Setup

1. **Start PostgreSQL**

    ```bash
    # Using Docker
    docker run --name wingtechbot-postgres \
      -e POSTGRES_PASSWORD=password \
      -e POSTGRES_DB=wingtechbot \
      -p 5432:5432 \
      -d postgres:15

    # Or use existing PostgreSQL installation
    ```

2. **Configure Environment**

    ```bash
    # .env
    DATABASE_URL="postgresql://postgres:password@localhost:5432/wingtechbot"
    ```

3. **Generate Client and Push Schema**
    ```bash
    pnpm db:generate   # Generate Prisma client
    pnpm db:push       # Push schema to database
    ```

### Common Commands

```bash
# Generate Prisma client and Kysely types
pnpm db:generate

# Push schema changes to database (dev only)
pnpm db:push

# Create and run migrations
pnpm db:migrate

# Open Prisma Studio (database GUI)
pnpm db:studio

# Seed database with sample data
pnpm db:seed

# Reset database (dev only)
pnpm db:reset

# View database structure
pnpm db:introspect
```

## 🔄 Migrations

### Creating Migrations

```bash
# Create new migration
npx prisma migrate dev --name add_user_roles

# Create migration without applying
npx prisma migrate dev --create-only --name add_user_roles
```

### Migration Files

```sql
-- migrations/20241201000000_add_user_roles/migration.sql
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");
```

### Production Migrations

```bash
# Deploy migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset migrations (dangerous!)
npx prisma migrate reset
```

## 📊 Query Examples

### Using Kysely (Recommended)

```typescript
import { db } from "../infrastructure/database/connection";

// Get all active guilds
const activeGuilds = await db.selectFrom("guilds").selectAll().where("is_active", "=", true).orderBy("created_at", "desc").execute();

// Get guild with member count
const guildWithMembers = await db
    .selectFrom("guilds")
    .leftJoin("guild_members", "guilds.id", "guild_members.guild_id")
    .select(["guilds.id", "guilds.name", db.fn.count("guild_members.user_id").as("actual_member_count")])
    .where("guilds.id", "=", guildId)
    .groupBy(["guilds.id", "guilds.name"])
    .executeTakeFirst();

// Complex query with multiple joins
const guildStats = await db
    .selectFrom("guilds")
    .leftJoin("guild_members", "guilds.id", "guild_members.guild_id")
    .leftJoin("users", "guild_members.user_id", "users.id")
    .select([
        "guilds.id",
        "guilds.name",
        db.fn.count("guild_members.user_id").as("member_count"),
        db.fn.max("guild_members.joined_at").as("last_join"),
        db.fn.avg(db.fn("extract", ["epoch", db.fn("age", ["guild_members.joined_at"])])).as("avg_member_age_seconds"),
    ])
    .where("guilds.is_active", "=", true)
    .groupBy(["guilds.id", "guilds.name"])
    .orderBy("member_count", "desc")
    .execute();
```

### Using Prisma Client

```typescript
import { prisma } from "../infrastructure/database/prisma";

// Get guilds with members
const guildsWithMembers = await prisma.guild.findMany({ where: { isActive: true }, include: { members: { include: { user: true } } } });

// Create guild with transaction
const createGuildWithOwner = await prisma.$transaction(async tx => {
    const user = await tx.user.upsert({ where: { id: ownerId }, update: {}, create: { id: ownerId, username: ownerUsername } });

    const guild = await tx.guild.create({ data: { id: guildId, name: guildName, ownerId: ownerId, members: { create: { userId: ownerId, roles: ["owner"] } } } });

    return guild;
});
```

## 🎯 Database Services

### Guild Service

```typescript
export class GuildService {
    constructor(private readonly db: Kysely<DB>) {}

    async createGuild(data: CreateGuildData): Promise<Guild> {
        return await this.db
            .insertInto("guilds")
            .values({ id: data.id, name: data.name, owner_id: data.ownerId, member_count: data.memberCount || 0, is_active: true, created_at: new Date(), updated_at: new Date() })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async getGuildById(id: string): Promise<Guild | null> {
        return (await this.db.selectFrom("guilds").selectAll().where("id", "=", id).executeTakeFirst()) || null;
    }

    async updateGuild(id: string, data: UpdateGuildData): Promise<Guild> {
        return await this.db
            .updateTable("guilds")
            .set({ ...data, updated_at: new Date() })
            .where("id", "=", id)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async deleteGuild(id: string): Promise<void> {
        await this.db.deleteFrom("guilds").where("id", "=", id).execute();
    }
}
```

## 🔄 Database Seeding

### Seed Script

```typescript
// scripts/seed.ts
import { db } from "../src/infrastructure/database/connection";

async function seed() {
    console.log("🌱 Seeding database...");

    // Create test guilds
    const testGuilds = [
        { id: "123456789012345678", name: "Test Guild 1", owner_id: "987654321098765432", member_count: 150 },
        { id: "876543210987654321", name: "Test Guild 2", owner_id: "456789012345678901", member_count: 75 },
    ];

    for (const guild of testGuilds) {
        await db
            .insertInto("guilds")
            .values({ ...guild, is_active: true, created_at: new Date(), updated_at: new Date() })
            .onConflict(oc => oc.column("id").doNothing())
            .execute();
    }

    // Create test users
    const testUsers = [
        { id: "987654321098765432", username: "testowner1", global_name: "Test Owner 1" },
        { id: "456789012345678901", username: "testowner2", global_name: "Test Owner 2" },
    ];

    for (const user of testUsers) {
        await db
            .insertInto("users")
            .values({ ...user, created_at: new Date(), updated_at: new Date() })
            .onConflict(oc => oc.column("id").doNothing())
            .execute();
    }

    console.log("✅ Database seeded successfully");
}

seed()
    .catch(error => {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });
```

## 📈 Performance Optimization

### Indexing Strategy

```sql
-- Frequently queried columns
CREATE INDEX idx_guilds_is_active ON guilds(is_active);
CREATE INDEX idx_guilds_owner_id ON guilds(owner_id);
CREATE INDEX idx_guilds_created_at ON guilds(created_at);

-- Composite indexes for complex queries
CREATE INDEX idx_guilds_active_created ON guilds(is_active, created_at DESC);
CREATE INDEX idx_guild_members_guild_joined ON guild_members(guild_id, joined_at DESC);

-- Partial indexes for specific conditions
CREATE INDEX idx_active_guilds ON guilds(created_at) WHERE is_active = true;
```

### Connection Pooling

```typescript
// database/connection.ts
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum connections
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Timeout for new connections
});

export const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

// Graceful shutdown
process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
});
```

### Query Optimization

```typescript
// ✅ Good: Use indexes
const recentGuilds = await db
    .selectFrom("guilds")
    .selectAll()
    .where("is_active", "=", true) // Uses index
    .orderBy("created_at", "desc") // Uses index
    .limit(10)
    .execute();

// ✅ Good: Batch operations
const updateMultipleGuilds = await db.updateTable("guilds").set({ updated_at: new Date() }).where("id", "in", guildIds).execute();

// ❌ Bad: N+1 queries
for (const guild of guilds) {
    const members = await db.selectFrom("guild_members").selectAll().where("guild_id", "=", guild.id).execute();
}

// ✅ Good: Single query with join
const guildsWithMembers = await db.selectFrom("guilds").leftJoin("guild_members", "guilds.id", "guild_members.guild_id").selectAll().execute();
```

## 🧪 Testing Database

### Test Database Setup

```typescript
// tests/setup/database.ts
import { db } from "../../src/infrastructure/database/connection";

export async function setupTestDatabase() {
    // Clean all tables
    await db.deleteFrom("guild_members").execute();
    await db.deleteFrom("guilds").execute();
    await db.deleteFrom("users").execute();
}

export async function teardownTestDatabase() {
    await db.destroy();
}

// Test helpers
export function createTestGuild(overrides = {}) {
    return { id: "123456789012345678", name: "Test Guild", owner_id: "987654321098765432", member_count: 100, is_active: true, created_at: new Date(), updated_at: new Date(), ...overrides };
}
```

### Database Tests

```typescript
// tests/database/guild.test.ts
describe("Guild Database Operations", () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await teardownTestDatabase();
    });

    describe("createGuild", () => {
        it("should create a guild", async () => {
            const guildData = createTestGuild();

            const guild = await db.insertInto("guilds").values(guildData).returningAll().executeTakeFirstOrThrow();

            expect(guild).toMatchObject(guildData);
        });

        it("should enforce unique constraint", async () => {
            const guildData = createTestGuild();

            await db.insertInto("guilds").values(guildData).execute();

            await expect(db.insertInto("guilds").values(guildData).execute()).rejects.toThrow();
        });
    });
});
```

## 🚨 Backup & Recovery

### Backup Strategy

```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Create compressed backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup specific tables
pg_dump $DATABASE_URL -t guilds -t users > partial_backup.sql
```

### Automated Backups

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/wingtechbot_$TIMESTAMP.sql.gz"

# Create backup
pg_dump $DATABASE_URL | gzip > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "wingtechbot_*.sql.gz" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"
```

### Recovery

```bash
# Restore from backup
psql $DATABASE_URL < backup_20241201_120000.sql

# Restore from compressed backup
gunzip -c backup_20241201_120000.sql.gz | psql $DATABASE_URL
```

## 📊 Monitoring

### Query Performance

```typescript
// Enable query logging in development
if (process.env.NODE_ENV === "development") {
    db.on("query", event => {
        console.log("SQL:", event.sql);
        console.log("Duration:", event.duration, "ms");
        console.log("Parameters:", event.parameters);
    });
}
```

### Health Check

```typescript
export async function checkDatabaseHealth() {
    try {
        const result = await db.selectFrom("guilds").select(db.fn.count("id").as("count")).executeTakeFirst();

        return { status: "healthy", guilds: result?.count || 0, timestamp: new Date().toISOString() };
    } catch (error) {
        return { status: "unhealthy", error: error.message, timestamp: new Date().toISOString() };
    }
}
```

For additional database help and troubleshooting, see the Prisma and Kysely documentation.
