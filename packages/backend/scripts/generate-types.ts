#!/usr/bin/env tsx
import { execSync } from "node:child_process";

import { loadEnvironment } from "../src/infrastructure/config/EnvLoader.js";

await loadEnvironment();

async function generateTypes() {
    try {
        console.log("🔧 Generating database types...");

        // Run kysely-codegen with explicit config path and output file
        execSync("kysely-codegen --config-file ./kysely-codegen.json --out-file ./database/types.ts", { stdio: "inherit", env: process.env });

        console.log("✅ Database types generated successfully!");
    } catch (error) {
        console.error("❌ Failed to generate database types:", error);
        console.log("💡 Make sure DATABASE_URL is set and database is accessible");
        process.exit(1);
    }
}

generateTypes();
