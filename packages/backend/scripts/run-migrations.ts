#!/usr/bin/env tsx
import "@dotenvx/dotenvx/config";

import { runMigrations } from "../src/infrastructure/database/migrations.js";

async function main() {
    try {
        await runMigrations();
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

main();
