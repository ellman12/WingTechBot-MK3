import { HealthCheckResponseSchema } from "@wingtechbot-mk3/types/api/v1/health";
import type { Request, Response } from "express";

import type { RouteGroup } from "../../../infrastructure/http/api/types.js";

/**
 * Health check routes configuration for API v1
 */
export const createHealthRoutes = (): RouteGroup => ({
    name: "health",
    basePath: "",
    tags: ["Health"],
    routes: [
        {
            method: "get",
            path: "/health",
            summary: "Health check endpoint",
            description: "Returns the current health status of the API",
            tags: ["Health"],
            handler: (_req: Request, res: Response): void => {
                const response = { status: "ok" as const, timestamp: new Date().toISOString(), version: "v1" as const };
                res.json(response);
            },
            responseSchema: HealthCheckResponseSchema,
        },
    ],
});
