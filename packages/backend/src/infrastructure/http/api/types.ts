import type { z } from "zod/v4";

export type ApiVersion = "v1" | "v2";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface RouteDefinition {
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
}

export interface ApiVersionConfig {
    readonly version: ApiVersion;
    readonly basePath: string;
    readonly deprecated?: boolean;
    readonly deprecationDate?: Date;
    readonly sunsetDate?: Date;
    readonly routes: readonly RouteDefinition[];
}

export interface RouteRegistryEntry extends RouteDefinition {
    readonly version: ApiVersion;
    readonly fullPath: string;
    readonly basePath: string;
}
