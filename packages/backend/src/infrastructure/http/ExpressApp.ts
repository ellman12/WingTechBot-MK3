import type { Config } from "@core/config/Config.js";
import type { DB } from "@db/types.js";
import { setupSwaggerUI } from "@infrastructure/http/OpenApiGenerator.js";
import { initializeApiRouter, setupRoutes as setupApiRoutes } from "@infrastructure/http/api/ApiRouter.js";
import cors from "cors";
import express from "express";
import type { Application } from "express";
import helmet from "helmet";
import type { Kysely } from "kysely";

export type ServerConfig = {
    readonly port: number;
    readonly nodeEnv: string;
    readonly corsOrigin: string | false;
};

export type ExpressAppDeps = {
    readonly db: Kysely<DB>;
    readonly config: ServerConfig;
    readonly appConfig: Config;
};

export type ExpressApp = {
    readonly app: Application;
    readonly start: () => void;
};

export const createExpressApp = (deps: ExpressAppDeps): ExpressApp => {
    const app = express();

    const setupMiddleware = (): void => {
        app.use(helmet());
        app.use(cors());

        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        if (deps.config.corsOrigin) {
            app.use(cors({ origin: deps.config.corsOrigin }));
        }
    };

    const setupRoutes = (): void => {
        initializeApiRouter(app, deps.db);
        setupApiRoutes();
    };

    const setupDocumentation = (): void => {
        setupSwaggerUI(app, deps.appConfig);
    };

    const start = (): void => {
        app.listen(deps.config.port, () => {
            console.log(`🚀 Server running on port ${deps.config.port}`);
            console.log(`📚 API Documentation: http://localhost:${deps.config.port}/api/docs`);
        });
    };

    setupMiddleware();
    setupRoutes();
    setupDocumentation();

    return {
        app,
        start,
    };
};
