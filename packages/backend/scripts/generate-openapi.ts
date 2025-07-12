#!/usr/bin/env node
import "@dotenvx/dotenvx/config";
import { writeFileSync } from "fs";
import { join } from "path";

import { initializeV1Routes } from "../src/application/routes/v1/routes.js";
import { generateOpenApiSpec } from "../src/infrastructure/http/OpenApiGenerator.js";

const generateOpenApiFile = (): void => {
    try {
        console.log("🔧 Generating OpenAPI specification...");

        // Initialize routes first (this registers them with the registry)
        console.log("📋 Initializing route registry...");
        initializeV1Routes();

        // Generate the OpenAPI spec
        const openApiSpec = generateOpenApiSpec();

        // Write to the docs directory
        const outputPath = join(process.cwd(), "docs", "openapi.json");
        const jsonContent = JSON.stringify(openApiSpec, null, 4);

        writeFileSync(outputPath, jsonContent, "utf8");

        console.log(`✅ OpenAPI specification generated successfully at: ${outputPath}`);
        console.log(`📊 Generated spec includes:`);
        console.log(`   - ${Object.keys(openApiSpec.paths || {}).length} paths`);
        console.log(`   - ${Object.keys((openApiSpec.components as Record<string, unknown>)?.schemas || {}).length} schemas`);
        console.log(`   - ${((openApiSpec.tags as Array<unknown>) || []).length} tags`);
    } catch (error) {
        console.error("❌ Failed to generate OpenAPI specification:", error);
        process.exit(1);
    }
};

generateOpenApiFile();
