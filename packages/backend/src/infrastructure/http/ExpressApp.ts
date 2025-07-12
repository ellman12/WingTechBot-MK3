import { setupSwaggerUI } from "@infrastructure/http/OpenApiGenerator.js";
import { initializeApiRouter, setupRoutes as setupApiRoutes } from "@infrastructure/http/api/ApiRouter.js";
import cors from "cors";
import express from "express";
import type { Application } from "express";
import helmet from "helmet";
import type { Kysely } from "kysely";
import type { DB } from "kysely-codegen";

export interface ServerConfig {
    port: number;
    nodeEnv: string;
    corsOrigin: string | false;
}

// Private state using file-level constants
let appInstance: Application | null = null;
let dbInstance: Kysely<DB> | null = null;

// Private functions
const setupMiddleware = (app: Application): void => {
    // Security middleware
    app.use(helmet());
    app.use(cors());

    // Body parsing
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
};

const setupRoutes = (app: Application, db: Kysely<DB>): void => {
    initializeApiRouter(app, db);
    setupApiRoutes();
};

const setupDocumentation = (app: Application): void => {
    setupSwaggerUI(app);
};

// Public interface - exported functions
export const createExpressApp = (db: Kysely<DB>, config: ServerConfig): Application => {
    const app = express();

    appInstance = app;
    dbInstance = db;

    setupMiddleware(app);
    setupRoutes(app, db);
    setupDocumentation(app);

    // Configure CORS based on config
    if (config.corsOrigin) {
        app.use(cors({ origin: config.corsOrigin }));
    }

    return app;
};

export const startServer = (app: Application, port: number): void => {
    app.listen(port, () => {
        console.log(`🚀 Server running on port ${port}`);
        console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    });
};

export const getExpressApp = (): Application | null => {
    return appInstance;
};

export const getExpressDatabase = (): Kysely<DB> | null => {
    return dbInstance;
};
