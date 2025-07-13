import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import type { Request, Response } from "express";
import { z } from "zod";

import type { RouteGroup } from "../../../infrastructure/http/api/types.js";

extendZodWithOpenApi(z);

const HealthCheckResponseSchema = z.object({ status: z.literal("ok"), timestamp: z.string(), version: z.literal("v1") }).openapi({ title: "HealthCheckResponse", description: "Health check response indicating API status" });

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
