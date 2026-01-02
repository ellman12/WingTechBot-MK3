#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { initializeV1Routes } from "../src/application/routes/v1/routes.js";
import { loadEnvironment } from "../src/infrastructure/config/EnvLoader.js";
import { generateOpenApiSpec } from "../src/infrastructure/http/OpenApiGenerator.js";

await loadEnvironment();

const syncOpenApiDocs = (): void => {
    try {
        console.log("🔄 Syncing OpenAPI documentation...");

        // Initialize routes first
        console.log("📋 Initializing route registry...");
        initializeV1Routes();

        // Generate the OpenAPI spec
        const openApiSpec = generateOpenApiSpec();
        const outputPath = join(process.cwd(), "docs", "openapi.json");
        const jsonContent = JSON.stringify(openApiSpec, null, 4);

        // Check if the file exists and compare content
        let needsUpdate = true;
        if (existsSync(outputPath)) {
            try {
                const existingContent = readFileSync(outputPath, "utf8");
                if (existingContent === jsonContent) {
                    console.log("✅ OpenAPI documentation is already up to date");
                    needsUpdate = false;
                }
            } catch {
                console.log("⚠️ Could not read existing file, will regenerate");
            }
        }

        if (needsUpdate) {
            writeFileSync(outputPath, jsonContent, "utf8");
            console.log(`✅ OpenAPI documentation updated at: ${outputPath}`);
            console.log(`📊 Updated spec includes:`);
            console.log(`   - ${Object.keys(openApiSpec.paths || {}).length} paths`);
            console.log(`   - ${Object.keys((openApiSpec.components as Record<string, unknown>)?.schemas || {}).length} schemas`);
            console.log(`   - ${((openApiSpec.tags as Array<unknown>) || []).length} tags`);
        }
    } catch (error) {
        console.error("❌ Failed to sync OpenAPI documentation:", error);
        process.exit(1);
    }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    syncOpenApiDocs();
}

export { syncOpenApiDocs };
