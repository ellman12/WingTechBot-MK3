#!/usr/bin/env tsx
import { runMigrations } from "../database/migrations.js";
import { loadEnvironment } from "../src/infrastructure/config/EnvLoader.js";

await loadEnvironment();

async function main() {
    try {
        await runMigrations();
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

main();
