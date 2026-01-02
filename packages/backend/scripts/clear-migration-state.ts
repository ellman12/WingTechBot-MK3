#!/usr/bin/env tsx
import { sql } from "kysely";

import { getKyselyForMigrations } from "../database/migrations.js";
import { loadEnvironment } from "../src/infrastructure/config/EnvLoader.js";

await loadEnvironment();

async function clearMigrationState() {
    console.log("🧹 Clearing database and Kysely migration tracking state...");

    const db = getKyselyForMigrations();

    try {
        // Drop and recreate the schema to completely clear the database
        console.log("🗑️  Dropping and recreating database schema...");
        await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
        console.log("✅ Database schema cleared");

        // Ensure the migration tracking table is gone (CASCADE should handle it, but be explicit)
        try {
            await sql`DROP TABLE IF EXISTS kysely_migrations CASCADE`.execute(db);
        } catch {
            // Ignore if it doesn't exist
        }

        console.log("✅ Migration tracking state cleared");
        console.log("💡 Run 'pnpm db:migrate' to apply migrations to the fresh database");
    } catch (error) {
        console.error("❌ Failed to clear database and migration state:", error);
        throw error;
    } finally {
        await db.destroy();
    }
}

clearMigrationState().catch(console.error);
