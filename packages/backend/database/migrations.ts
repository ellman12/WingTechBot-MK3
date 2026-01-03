import type { DB } from "@db/types.js";
import { promises as fs } from "fs";
import { Kysely, Migrator, PostgresDialect } from "kysely";
import type { Migration } from "kysely";
import { join } from "path";
import { Pool } from "pg";
import { pathToFileURL } from "url";

export const getKyselyForMigrations = (schemaName?: string): Kysely<DB> => {
    const connectionString = process.env.DATABASE_URL;
    const sanitizedSchema = schemaName?.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

    const pool = new Pool({ connectionString });

    if (sanitizedSchema) {
        pool.on("connect", client => {
            return client.query(`SET search_path TO ${sanitizedSchema}`);
        });
    }

    return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
};

const migrationProvider = {
    async getMigrations() {
        // In production (compiled), look in dist/database/migrations
        // In development (tsx), look in database/migrations
        const isDist = import.meta.url.includes("/dist/");
        const migrationsPath = isDist ? join(".", "dist", "database", "migrations") : join(".", "database", "migrations");
        const files = await fs.readdir(migrationsPath);

        const migrations: Record<string, Migration> = {};

        for (const file of files) {
            // Skip declaration files and index files (but not files with "index" in their name)
            if (file.endsWith(".d.ts") || file === "index.ts" || file === "index.js") {
                continue;
            }

            const fileExt = file.split(".").pop();
            if (fileExt === "ts" || fileExt === "js") {
                const name = file.replace(`.${fileExt}`, "");
                // Use pathToFileURL to create proper file:// URL for dynamic import
                const filePath = pathToFileURL(join(migrationsPath, file)).href;
                const migration = await import(filePath);
                migrations[name] = { up: migration.up, down: migration.down };
            }
        }

        console.log(`🔍 Found ${Object.keys(migrations).length} migrations:`, Object.keys(migrations));

        return migrations;
    },
};

export const runMigrations = async (schemaName?: string): Promise<void> => {
    const db = getKyselyForMigrations(schemaName);

    const sanitizedSchema = schemaName?.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

    const migratorConfig = sanitizedSchema ? { db, provider: migrationProvider, migrationTableSchema: sanitizedSchema } : { db, provider: migrationProvider };

    const migrator = new Migrator(migratorConfig);

    try {
        const { error, results } = await migrator.migrateToLatest();

        if (error) {
            console.error("❌ Migration failed:", error);
            throw error;
        }

        if (results && results.length > 0) {
            console.log(
                "✅ Migrations executed:",
                results.map(r => r.migrationName)
            );
        } else {
            console.log("✅ Database is up to date");
        }
    } finally {
        await db.destroy();
    }
};

export const rollbackMigrations = async (): Promise<void> => {
    const db = getKyselyForMigrations();
    const migrator = new Migrator({ db, provider: migrationProvider });

    try {
        const { error, results } = await migrator.migrateDown();

        if (error) {
            console.error("❌ Rollback failed:", error);
            throw error;
        }

        if (results && results.length > 0) {
            console.log(
                "✅ Migrations rolled back:",
                results.map(r => r.migrationName)
            );
        } else {
            console.log("✅ No migrations to rollback");
        }
    } finally {
        await db.destroy();
    }
};
