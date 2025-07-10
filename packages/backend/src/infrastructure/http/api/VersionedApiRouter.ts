import type { Application, Router } from 'express';
import express from 'express';
import type { Kysely } from 'kysely';

import { createV1ApiConfiguration } from '../../../application/routes/v1/routes.js';
import type { DB } from '../../../generated/database/types.js';
import { VersionedRouteRegistry } from './VersionedRouteRegistry.js';

// Convert OpenAPI path format {id} to Express format :id
const openApiToExpressPath = (path: string): string => {
  return path.replace(/{([^}]+)}/g, ':$1');
};

export class VersionedApiRouter {
  private readonly db: Kysely<DB>;

  constructor(db: Kysely<DB>) {
    this.db = db;
  }

  /**
   * Setup all versioned API routes
   */
  setupRoutes(app: Application): void {
    // Register v1 API
    const v1Config = createV1ApiConfiguration(this.db);
    VersionedRouteRegistry.registerVersion(v1Config);

    // Create versioned routers
    this.setupV1Routes(app);

    // Setup health check route
    this.setupHealthCheckRoute(app);

    // Log registered versions
    this.logRegisteredVersions();
  }

  private setupV1Routes(app: Application): void {
    const v1Router: Router = express.Router();
    const v1Routes = VersionedRouteRegistry.getVersionRoutes('v1');

    v1Routes.forEach(route => {
      const expressPath = openApiToExpressPath(route.path.replace('/api/v1', ''));

      // Register the route with Express
      v1Router[route.method](expressPath, route.handler);
    });

    // Mount v1 router
    app.use('/api/v1', v1Router);
  }

  private setupHealthCheckRoute(app: Application): void {
    // Health check route is now handled by the health routes configuration
    // No need to manually register it here since it's part of the v1 API configuration
  }

  private logRegisteredVersions(): void {
    const versions = VersionedRouteRegistry.getSupportedVersions();
    console.log(`📋 Registered API versions: ${versions.join(', ')}`);

    versions.forEach(version => {
      const routes = VersionedRouteRegistry.getVersionRoutes(version);
      const config = VersionedRouteRegistry.getVersionConfig(version);

      if (config) {
        console.log(
          `🔗 ${version.toUpperCase()} API base URL: http://localhost:3000${config.basePath}`
        );
        console.log(`   ${routes.length} routes registered`);

        if (config.deprecated) {
          console.warn(`⚠️  ${version.toUpperCase()} API is deprecated`);
          if (config.deprecationDate) {
            console.warn(`   Deprecated since: ${config.deprecationDate.toISOString()}`);
          }
          if (config.sunsetDate) {
            console.warn(`   Sunset date: ${config.sunsetDate.toISOString()}`);
          }
        }
      }
    });
  }

  /**
   * Get the versioned route registry instance
   */
  getRegistry() {
    return VersionedRouteRegistry;
  }
}
