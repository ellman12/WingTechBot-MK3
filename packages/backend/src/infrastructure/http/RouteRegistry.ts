import { z } from 'zod';

export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  summary: string;
  description?: string | undefined;
  tags: string[];
  requestSchema?: z.ZodSchema | undefined;
  responseSchema?: z.ZodSchema | undefined;
  paramsSchema?: z.ZodSchema | undefined;
  querySchema?: z.ZodSchema | undefined;
}

class RouteRegistryClass {
  private routes: RouteDefinition[] = [];

  register(route: RouteDefinition): void {
    this.routes.push(route);
  }

  getRoutes(): RouteDefinition[] {
    return [...this.routes];
  }

  clear(): void {
    this.routes = [];
  }
}

export const RouteRegistry = new RouteRegistryClass();
