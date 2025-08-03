# Database Guide

## Overview

WingTechBot MK3 uses PostgreSQL as its primary database with Prisma as the ORM and Kysely for type-safe SQL queries.

## Database Schema

### Core Tables

\`\`\`sql
-- Users table
CREATE TABLE users (
id VARCHAR(255) PRIMARY KEY,
username VARCHAR(255) NOT NULL,
discord_id VARCHAR(255) UNIQUE NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guilds table
CREATE TABLE guilds (
id VARCHAR(255) PRIMARY KEY,
name VARCHAR(255) NOT NULL,
owner_id VARCHAR(255) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Database Operations

### Using Prisma

\`\`\`typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Create a user
const user = await prisma.user.create({
data: {
id: 'user123',
username: 'example_user',
discordId: 'discord123'
}
})

// Find user by Discord ID
const user = await prisma.user.findUnique({
where: { discordId: 'discord123' }
})
\`\`\`

### Using Kysely

\`\`\`typescript
import { db } from '../infrastructure/database'

// Type-safe queries
const users = await db
.selectFrom('users')
.select(['id', 'username', 'discord_id'])
.where('created_at', '>', new Date('2024-01-01'))
.execute()
\`\`\`

## Migrations

### Creating Migrations

\`\`\`bash

# Generate migration from schema changes

pnpm db:migrate:create

# Apply migrations

pnpm db:migrate

# Rollback migrations

pnpm db:migrate:rollback
\`\`\`

### Migration Best Practices

1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Use descriptive migration names**
4. **Include rollback scripts**

## Performance Optimization

### Indexing

\`\`\`sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_discord_id ON users(discord_id);
CREATE INDEX idx_guilds_owner_id ON guilds(owner_id);
\`\`\`

### Query Optimization

- Use SELECT only needed columns
- Implement pagination for large datasets
- Use database transactions for related operations
- Monitor slow queries with logging

## Backup and Recovery

### Automated Backups

\`\`\`bash

# Create backup

pg_dump -h localhost -U username wingtechbot > backup.sql

# Restore from backup

psql -h localhost -U username wingtechbot < backup.sql
\`\`\`

### Backup Strategy

- **Daily backups** for production
- **Point-in-time recovery** for critical data
- **Test restore procedures** regularly
- **Store backups securely** with encryption

For more advanced database operations, see the [Development Guide](/guide/development).
