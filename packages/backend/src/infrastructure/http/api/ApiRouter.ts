import type { Application } from "express";
import { Router } from "express";
import type { Kysely } from "kysely";

import type { DB } from "../../../generated/database/types.js";
import { RouteRegistry } from "./RouteRegistry.js";
import type { ApiVersionConfig } from "./types.js";

export class ApiRouter {
    private app: Application;
    private db: Kysely<DB>;

    constructor(app: Application, db: Kysely<DB>) {
        this.app = app;
        this.db = db;
    }

    public setupRoutes(): void {
        // Register API version configurations
        const v1Config: ApiVersionConfig = {
            version: "v1",
            basePath: "/api/v1",
            deprecated: false,
            routes: [
                // Routes would be defined here
                // For now, we'll have an empty array since the route files need to be created
            ],
        };

        RouteRegistry.registerVersion(v1Config);

        // Setup routes for each version
        this.setupVersionRoutes();

        // Setup version listing endpoint
        this.setupVersionEndpoint();
    }

    private setupVersionRoutes(): void {
        const v1Routes = RouteRegistry.getVersionRoutes("v1");
        const v1Router = Router();

        v1Routes.forEach(route => {
            console.log(`📍 Registering ${route.method.toUpperCase()} ${route.fullPath}`);
            // Route registration logic would go here
            // This is where you'd actually register the Express routes
        });

        this.app.use("/api/v1", v1Router);
    }

    private setupVersionEndpoint(): void {
        this.app.get("/api/versions", (req, res) => {
            const versions = RouteRegistry.getSupportedVersions();

            const versionInfo = versions.map(version => {
                const routes = RouteRegistry.getVersionRoutes(version);
                const config = RouteRegistry.getVersionConfig(version);

                return {
                    version,
                    basePath: config?.basePath,
                    deprecated: config?.deprecated,
                    deprecationDate: config?.deprecationDate?.toISOString(),
                    sunsetDate: config?.sunsetDate?.toISOString(),
                    routeCount: routes.length,
                    routes: routes.map(route => ({ method: route.method.toUpperCase(), path: route.fullPath, summary: route.summary, deprecated: route.deprecated })),
                };
            });

            res.json({ title: "WingTechBot MK3 API Versions", totalVersions: versions.length, versions: versionInfo });
        });
    }

    public getDatabase(): Kysely<DB> {
        return this.db;
    }

    public getApp(): Application {
        return this.app;
    }

    public getRegistry(): typeof RouteRegistry {
        return RouteRegistry;
    }
}
