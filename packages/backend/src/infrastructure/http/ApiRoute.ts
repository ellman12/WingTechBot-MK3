/**
 * @deprecated This module is deprecated. Use the new versioned API system in ./api/ instead.
 *
 * Migration path:
 * 1. Create route configurations in ./api/v1/routes.ts or ./api/v2/routes.ts
 * 2. Use VersionedApiRouter instead of manual route registration
 * 3. Define schemas in versioned schema files (e.g., ./api/v1/schemas.ts)
 *
 * This file is kept for backward compatibility with existing scripts.
 */
import { RequestHandler, Router } from 'express';
import { z } from 'zod';

import { type RouteDefinition, RouteRegistry } from './RouteRegistry.js';

interface ApiRouteOptions {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  handler: RequestHandler;
  requestSchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
  paramsSchema?: z.ZodSchema;
  querySchema?: z.ZodSchema;
}

// Convert OpenAPI path format {id} to Express format :id
const openApiToExpressPath = (path: string): string => {
  return path.replace(/{([^}]+)}/g, ':$1');
};

// Convert Express path format :id to OpenAPI format {id}
const expressToOpenApiPath = (path: string): string => {
  return path.replace(/:([^/]+)/g, '{$1}');
};

export const registerApiRoute = (router: Router, options: ApiRouteOptions): void => {
  // Convert OpenAPI path to Express path for route registration
  const expressPath = openApiToExpressPath(options.path);

  // Register the route with Express
  router[options.method](expressPath, options.handler);

  // Convert to OpenAPI path for documentation
  const openApiPath = expressToOpenApiPath(options.path);

  // Register the route for OpenAPI documentation
  const routeDefinition: RouteDefinition = {
    method: options.method,
    path: `/api/v1${openApiPath}`, // Add API prefix and use OpenAPI format
    summary: options.summary,
    tags: options.tags,
    requestSchema: options.requestSchema,
    responseSchema: options.responseSchema,
    paramsSchema: options.paramsSchema,
    querySchema: options.querySchema,
  };

  if (options.description) {
    routeDefinition.description = options.description;
  }

  RouteRegistry.register(routeDefinition);
};

// Helper for health check and other non-API routes
export const registerHealthRoute = (app: any, path: string, handler: RequestHandler): void => {
  app.get(path, handler);

  RouteRegistry.register({
    method: 'get',
    path,
    summary: 'Health check endpoint',
    description: 'Returns the current health status of the API',
    tags: ['Health'],
    responseSchema: z.object({
      status: z.literal('ok'),
      timestamp: z.string(),
    }),
  });
};
