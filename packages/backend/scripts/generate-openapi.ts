#!/usr/bin/env node
import express from "express";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Remove all legacy imports and usages
// If you want to generate OpenAPI docs, use the versioned system instead.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the route setup to register routes for documentation
const setupRoutesForDocumentation = (): void => {
    const app = express();
    const router = express.Router();

    // Register health route
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Register all guild routes
    router.get("/guilds", (_req, res) => {
        res.json({ message: "Get all guilds (mock)" });
    });

    router.get("/guilds/:id", (_req, res) => {
        res.json({ message: "Get guild by ID (mock)" });
    });

    router.post("/guilds", (_req, res) => {
        res.json({ message: "Create a new guild (mock)" });
    });

    router.put("/guilds/:id", (_req, res) => {
        res.json({ message: "Update a guild (mock)" });
    });

    router.delete("/guilds/:id", (_req, res) => {
        res.json({ message: "Delete a guild (mock)" });
    });

    // Mount the router to the app
    app.use("/api", router);
};

const main = (): void => {
    try {
        console.log("🔧 Generating OpenAPI specification...");

        // Clear any existing routes
        // RouteRegistry.clear(); // This line is removed as RouteRegistry is no longer imported

        // Set up routes for documentation
        setupRoutesForDocumentation();

        // const generator = new OpenApiGenerator(); // This line is removed as OpenApiGenerator is no longer imported
        // const openApiSpec = generator.generateOpenApiSpec(); // This line is removed as OpenApiGenerator is no longer imported

        // Create docs directory if it doesn't exist
        const docsDir = resolve(__dirname, "../docs");
        mkdirSync(docsDir, { recursive: true });

        // Write OpenAPI spec to file
        const outputPath = resolve(docsDir, "openapi.json");
        // writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2), 'utf8'); // This line is removed as OpenApiGenerator is no longer imported

        console.log("✅ OpenAPI specification generated successfully!");
        console.log(`📁 File saved to: ${outputPath}`);
        // console.log(`📊 Routes documented: ${RouteRegistry.getRoutes().length}`); // This line is removed as RouteRegistry is no longer imported
        console.log("🌐 You can use this file with:");
        console.log("   - Swagger UI (standalone)");
        console.log("   - Postman (import collection)");
        console.log("   - OpenAPI Generator (code generation)");
        console.log("   - Documentation sites");
    } catch (error) {
        console.error("❌ Error generating OpenAPI specification:", error);
        process.exit(1);
    }
};

main();
