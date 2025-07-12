import cors from "cors";
import express from "express";
import type { Application } from "express";
import helmet from "helmet";
import type { Kysely } from "kysely";

import type { DB } from "../../generated/database/types.js";
import { OpenApiGenerator } from "./OpenApiGenerator.js";
import { ApiRouter } from "./api/ApiRouter.js";

export class ExpressApp {
    private app: Application;
    private db: Kysely<DB>;

    constructor(db: Kysely<DB>) {
        this.app = express();
        this.db = db;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupDocumentation();
    }

    private setupMiddleware(): void {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors());

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    private setupRoutes(): void {
        const apiRouter = new ApiRouter(this.app, this.db);
        apiRouter.setupRoutes();
    }

    private setupDocumentation(): void {
        const openApiGenerator = new OpenApiGenerator();
        openApiGenerator.setupSwaggerUI(this.app);
    }

    public getApp(): Application {
        return this.app;
    }

    public start(port: number = 3000): void {
        this.app.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`);
            console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
        });
    }
}
