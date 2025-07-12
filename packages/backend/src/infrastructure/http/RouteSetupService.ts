import { initializeV1Routes } from "@application/routes/v1/routes.js";
import type { DB } from "@db/types";
import { getVersionRoutes } from "@infrastructure/http/api/RouteRegistry.js";
import type { Application } from "express";
import { Router } from "express";
import type { Kysely } from "kysely";

// Interface definition
export interface RouteSetupService {
    initialize(app: Application, db: Kysely<DB>): void;
    setupAllRoutes(): void;
    getApp(): Application | null;
    getDatabase(): Kysely<DB> | null;
}

// Private state using file-level constants
let appInstance: Application | null = null;
let dbInstance: Kysely<DB> | null = null;

// Private functions
const setupVersionRoutes = (app: Application): void => {
    const v1Routes = getVersionRoutes("v1");
    const v1Router = Router();

    v1Routes.forEach(route => {
        console.log(`📍 Registering ${route.method.toUpperCase()} ${route.fullPath}`);

        // Convert OpenAPI path format {id} to Express format :id
        const expressPath = route.path.replace(/\{([^}]+)\}/g, ":$1");

        // Register the route with Express
        switch (route.method) {
            case "get":
                v1Router.get(expressPath, route.handler);
                break;
            case "post":
                v1Router.post(expressPath, route.handler);
                break;
            case "put":
                v1Router.put(expressPath, route.handler);
                break;
            case "patch":
                v1Router.patch(expressPath, route.handler);
                break;
            case "delete":
                v1Router.delete(expressPath, route.handler);
                break;
            default:
                console.warn(`⚠️ Unknown HTTP method: ${route.method} for ${route.fullPath}`);
        }
    });

    app.use("/api/v1", v1Router);

    // Register health routes separately (they're not under /api/v1)
    const healthRoutes = getVersionRoutes("v1").filter(route => route.fullPath.startsWith("/health"));

    healthRoutes.forEach(route => {
        console.log(`📍 Registering health route: ${route.method.toUpperCase()} ${route.fullPath}`);
        const expressPath = route.path.replace(/\{([^}]+)\}/g, ":$1");

        switch (route.method) {
            case "get":
                app.get(expressPath, route.handler);
                break;
            case "post":
                app.post(expressPath, route.handler);
                break;
            case "put":
                app.put(expressPath, route.handler);
                break;
            case "patch":
                app.patch(expressPath, route.handler);
                break;
            case "delete":
                app.delete(expressPath, route.handler);
                break;
            default:
                console.warn(`⚠️ Unknown HTTP method: ${route.method} for ${route.fullPath}`);
        }
    });
};

const setupVersionEndpoint = (app: Application): void => {
    app.get("/api/versions", (req, res) => {
        const versions = getVersionRoutes("v1");

        const versionInfo = versions.map(route => ({ method: route.method.toUpperCase(), path: route.fullPath, summary: route.summary, deprecated: route.deprecated }));

        res.json({ title: "WingTechBot MK3 API Versions", totalVersions: 1, versions: [{ version: "v1", routes: versionInfo }] });
    });
};

// Export the service object that implements the interface
export const routeSetupService: RouteSetupService = {
    initialize(app: Application, db: Kysely<DB>): void {
        appInstance = app;
        dbInstance = db;
    },

    setupAllRoutes(): void {
        if (!appInstance || !dbInstance) {
            throw new Error("Route setup not initialized. Call initialize first.");
        }

        // Initialize route configurations (this registers routes with the registry)
        initializeV1Routes();

        // Setup Express routes for each version
        setupVersionRoutes(appInstance);

        // Setup version listing endpoint
        setupVersionEndpoint(appInstance);
    },

    getApp(): Application | null {
        return appInstance;
    },

    getDatabase(): Kysely<DB> | null {
        return dbInstance;
    },
};
