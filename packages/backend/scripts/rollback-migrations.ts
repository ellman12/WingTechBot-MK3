#!/usr/bin/env tsx
import { rollbackMigrations } from "../database/migrations.js";
import { loadEnvironment } from "../src/infrastructure/config/EnvLoader.js";

await loadEnvironment();

async function main() {
    try {
        await rollbackMigrations();
    } catch (error) {
        console.error("❌ Rollback failed:", error);
        process.exit(1);
    }
}

main();
