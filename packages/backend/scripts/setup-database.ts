#!/usr/bin/env tsx
import "@dotenvx/dotenvx/config";
import { execSync } from "node:child_process";

import { runMigrations } from "../src/infrastructure/database/migrations.js";

async function setupDatabase() {
    console.log("🚀 Setting up database...");

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is required");
    }

    try {
        // Run Kysely migrations to set up schema
        console.log("📝 Running Kysely migrations...");
        await runMigrations();
        console.log("✅ Migrations executed successfully");

        // Generate types
        console.log("🔧 Generating types...");
        execSync("pnpm db:generate", { stdio: "inherit" });
        console.log("✅ Types generated successfully");
    } catch (error) {
        console.error("❌ Database setup failed:", error);
        throw error;
    }
}

setupDatabase().catch(console.error);
