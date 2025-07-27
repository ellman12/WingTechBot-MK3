import type { DB } from "@db/types";
import { promises as fs } from "fs";
import { Kysely, Migrator, PostgresDialect } from "kysely";
import type { Migration } from "kysely";
import { join } from "path";
import { Pool } from "pg";

export const getKyselyForMigrations = (): Kysely<DB> => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
};

const migrationProvider = {
    async getMigrations() {
        const migrationsPath = join(".", "database", "migrations");
        const files = await fs.readdir(migrationsPath);

        const migrations: Record<string, Migration> = {};

        for (const file of files) {
            if (file.endsWith(".ts") && file !== "index.ts") {
                const name = file.replace(".ts", "");
                const migration = await import(join(migrationsPath, file));
                migrations[name] = { up: migration.up, down: migration.down };
            }
        }

        console.log(`🔍 Found ${Object.keys(migrations).length} migrations:`, Object.keys(migrations));

        return migrations;
    },
};

export const runMigrations = async (): Promise<void> => {
    const db = getKyselyForMigrations();
    const migrator = new Migrator({ db, provider: migrationProvider });

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
