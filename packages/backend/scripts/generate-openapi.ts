#!/usr/bin/env node
import express from 'express';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { registerApiRoute, registerHealthRoute } from '../src/infrastructure/http/ApiRoute.js';
import { OpenApiGenerator } from '../src/infrastructure/http/OpenApiGenerator.js';
import { RouteRegistry } from '../src/infrastructure/http/RouteRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the route setup to register routes for documentation
const setupRoutesForDocumentation = (): void => {
  const app = express();
  const router = express.Router();

  // Register health route
  registerHealthRoute(app, '/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Register all guild routes
  registerApiRoute(router, {
    method: 'get',
    path: '/guilds',
    summary: 'Get all guilds',
    description: 'Retrieve a list of all Discord guilds',
    tags: ['Guilds'],
    handler: () => {}, // Mock handler for docs generation
  });

  registerApiRoute(router, {
    method: 'get',
    path: '/guilds/{id}',
    summary: 'Get guild by ID',
    description: 'Retrieve a specific Discord guild by its ID',
    tags: ['Guilds'],
    handler: () => {}, // Mock handler for docs generation
  });

  registerApiRoute(router, {
    method: 'post',
    path: '/guilds',
    summary: 'Create a new guild',
    description: 'Create a new Discord guild entry',
    tags: ['Guilds'],
    handler: () => {}, // Mock handler for docs generation
  });

  registerApiRoute(router, {
    method: 'put',
    path: '/guilds/{id}',
    summary: 'Update a guild',
    description: 'Update an existing Discord guild',
    tags: ['Guilds'],
    handler: () => {}, // Mock handler for docs generation
  });

  registerApiRoute(router, {
    method: 'delete',
    path: '/guilds/{id}',
    summary: 'Delete a guild',
    description: 'Remove a Discord guild entry',
    tags: ['Guilds'],
    handler: () => {}, // Mock handler for docs generation
  });
};

const main = (): void => {
  try {
    console.log('🔧 Generating OpenAPI specification...');

    // Clear any existing routes
    RouteRegistry.clear();

    // Set up routes for documentation
    setupRoutesForDocumentation();

    const generator = new OpenApiGenerator();
    const openApiSpec = generator.generateOpenApiSpec();

    // Create docs directory if it doesn't exist
    const docsDir = resolve(__dirname, '../docs');
    mkdirSync(docsDir, { recursive: true });

    // Write OpenAPI spec to file
    const outputPath = resolve(docsDir, 'openapi.json');
    writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2), 'utf8');

    console.log('✅ OpenAPI specification generated successfully!');
    console.log(`📁 File saved to: ${outputPath}`);
    console.log(`📊 Routes documented: ${RouteRegistry.getRoutes().length}`);
    console.log('🌐 You can use this file with:');
    console.log('   - Swagger UI (standalone)');
    console.log('   - Postman (import collection)');
    console.log('   - OpenAPI Generator (code generation)');
    console.log('   - Documentation sites');
  } catch (error) {
    console.error('❌ Error generating OpenAPI specification:', error);
    process.exit(1);
  }
};

main();
