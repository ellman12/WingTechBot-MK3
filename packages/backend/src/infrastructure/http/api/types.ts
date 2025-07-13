import type { RequestHandler } from "express";
import type { z } from "zod/v4";

export type ApiVersion = "v1" | "v2";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type RouteDefinition = {
    readonly path: string;
    readonly method: HttpMethod;
    readonly summary: string;
    readonly description?: string;
    readonly tags: readonly string[];
    readonly deprecated?: boolean;
    readonly paramsSchema?: z.ZodTypeAny;
    readonly querySchema?: z.ZodTypeAny;
    readonly requestSchema?: z.ZodTypeAny;
    readonly responseSchema?: z.ZodTypeAny;
    readonly handler: RequestHandler;
};

export type ApiVersionConfig = {
    readonly version: ApiVersion;
    readonly basePath: string;
    readonly deprecated?: boolean;
    readonly deprecationDate?: Date;
    readonly sunsetDate?: Date;
    readonly routes: readonly RouteDefinition[];
};

export type RouteRegistryEntry = RouteDefinition & {
    readonly version: ApiVersion;
    readonly fullPath: string;
    readonly basePath: string;
};

export type RouteGroup = {
    readonly name: string;
    readonly basePath: string;
    readonly tags: readonly string[];
    readonly routes: readonly RouteDefinition[];
};
