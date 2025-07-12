#!/usr/bin/env tsx
import "@dotenvx/dotenvx/config";
import { execSync } from "node:child_process";

async function generateTypes() {
    try {
        console.log("🔧 Generating database types...");

        // Run kysely-codegen directly
        execSync("kysely-codegen", { stdio: "inherit", env: process.env });

        console.log("✅ Database types generated successfully!");
    } catch (error) {
        console.error("❌ Failed to generate database types:", error);
        process.exit(1);
    }
}

generateTypes();
