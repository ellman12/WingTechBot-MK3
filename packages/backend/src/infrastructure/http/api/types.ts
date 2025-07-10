import type { RequestHandler } from 'express';
import type { z } from 'zod';

// Supported API versions
export type ApiVersion = 'v1' | 'v2';

// Version configuration
export interface VersionConfig {
  readonly version: ApiVersion;
  readonly basePath: string;
  readonly deprecated?: boolean;
  readonly deprecationDate?: Date;
  readonly sunsetDate?: Date;
}

// Route definition for versioned APIs
export interface VersionedRouteDefinition {
  readonly method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  readonly path: string;
  readonly summary: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly handler: RequestHandler;
  readonly requestSchema?: z.ZodSchema;
  readonly responseSchema?: z.ZodSchema;
  readonly paramsSchema?: z.ZodSchema;
  readonly querySchema?: z.ZodSchema;
  readonly deprecated?: boolean;
}

// Route group for organizing related routes
export interface RouteGroup {
  readonly name: string;
  readonly basePath: string;
  readonly routes: readonly VersionedRouteDefinition[];
  readonly tags?: readonly string[];
}

// API version configuration with routes
export interface ApiVersionConfiguration {
  readonly config: VersionConfig;
  readonly groups: readonly RouteGroup[];
}

// Registry entry for versioned routes
export interface VersionedRouteRegistryEntry extends VersionedRouteDefinition {
  readonly version: ApiVersion;
  readonly fullPath: string;
}
