import { registerVersion } from "../../../infrastructure/http/api/RouteRegistry.js";
import type { ApiVersionConfig, RouteGroup } from "../../../infrastructure/http/api/types.js";
import { createHealthRoutes } from "./health.js";

/**
 * API v1 route configuration
 * This defines the application's routing contracts by organizing routes by feature
 */
export const createV1ApiConfiguration = (): { config: ApiVersionConfig; groups: RouteGroup[] } => ({ config: { version: "v1", basePath: "/api/v1", routes: [] }, groups: [createHealthRoutes()] });

/**
 * Initialize and register all v1 routes with the route registry
 * This handles the dependency mapping that was previously in ApiRouter
 */
export const initializeV1Routes = (): void => {
    const v1ApiConfig = createV1ApiConfiguration();

    // Flatten all groups and their routes into a single array for registration
    const v1Routes = v1ApiConfig.groups.flatMap((group: RouteGroup) => group.routes.map(route => ({ ...route, path: group.basePath + route.path, tags: group.tags })));

    const v1Config: ApiVersionConfig = {
        version: v1ApiConfig.config.version,
        basePath: v1ApiConfig.config.basePath,
        deprecated: v1ApiConfig.config.deprecated ?? false,
        ...(v1ApiConfig.config.deprecationDate && { deprecationDate: v1ApiConfig.config.deprecationDate }),
        ...(v1ApiConfig.config.sunsetDate && { sunsetDate: v1ApiConfig.config.sunsetDate }),
        routes: v1Routes,
    };

    registerVersion(v1Config);
};
