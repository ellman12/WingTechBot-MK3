#!/usr/bin/env tsx
import "@dotenvx/dotenvx/config";

import { rollbackMigrations } from "../src/infrastructure/database/migrations.js";

async function main() {
    try {
        await rollbackMigrations();
    } catch (error) {
        console.error("❌ Rollback failed:", error);
        process.exit(1);
    }
}

main();
