import type { ApiVersion, ApiVersionConfig } from "./types.js";
import type { RouteRegistryEntry } from "./types.js";

// Private state using file-level constants
const routes: Map<ApiVersion, RouteRegistryEntry[]> = new Map();
const versionConfigs: Map<ApiVersion, ApiVersionConfig> = new Map();

// Public interface - exported functions
export const registerVersion = (config: ApiVersionConfig): void => {
    versionConfigs.set(config.version, config);

    if (!routes.has(config.version)) {
        routes.set(config.version, []);
    }

    config.routes.forEach(route => {
        const fullPath = config.basePath + route.path;

        const registryEntry: RouteRegistryEntry = { ...route, version: config.version, fullPath, basePath: config.basePath, deprecated: route.deprecated ?? config.deprecated ?? false };

        routes.get(config.version)?.push(registryEntry);
    });

    console.log(`✅ Registered ${config.routes.length} routes for API version ${config.version}`);
};

export const getVersionRoutes = (version: ApiVersion): RouteRegistryEntry[] => {
    return routes.get(version) || [];
};

export const getSupportedVersions = (): ApiVersion[] => {
    return Array.from(routes.keys());
};

export const getAllRoutes = (): RouteRegistryEntry[] => {
    const allRoutes: RouteRegistryEntry[] = [];

    routes.forEach(routesList => {
        allRoutes.push(...routesList);
    });

    return allRoutes;
};

export const getVersionConfig = (version: ApiVersion): ApiVersionConfig | undefined => {
    return versionConfigs.get(version);
};

export const getRouteByPath = (method: string, path: string): RouteRegistryEntry | undefined => {
    for (const routesList of routes.values()) {
        const route = routesList.find(r => r.method === method.toLowerCase() && (r.fullPath === path || r.path === path));
        if (route) return route;
    }
    return undefined;
};

export const getRoutesByTag = (tag: string): RouteRegistryEntry[] => {
    const taggedRoutes: RouteRegistryEntry[] = [];

    routes.forEach(routesList => {
        routesList.forEach(route => {
            if (route.tags.includes(tag)) {
                taggedRoutes.push(route);
            }
        });
    });

    return taggedRoutes;
};

export const getDeprecatedRoutes = (): RouteRegistryEntry[] => {
    const deprecatedRoutes: RouteRegistryEntry[] = [];

    routes.forEach(routesList => {
        routesList.forEach(route => {
            if (route.deprecated) {
                deprecatedRoutes.push(route);
            }
        });
    });

    return deprecatedRoutes;
};

export const validateVersionSupport = (version: ApiVersion): boolean => {
    const config = versionConfigs.get(version);
    if (!config) return false;

    const now = new Date();

    // Check if version is past sunset date
    if (config.sunsetDate && now > config.sunsetDate) {
        return false;
    }

    return true;
};

export const getVersionStatus = (version: ApiVersion): "active" | "deprecated" | "sunset" | "unknown" => {
    const config = versionConfigs.get(version);
    if (!config) return "unknown";

    const now = new Date();

    if (config.sunsetDate && now > config.sunsetDate) {
        return "sunset";
    }

    if (config.deprecated) {
        return "deprecated";
    }

    return "active";
};

export const getRoutesForDocumentation = (): Map<ApiVersion, RouteRegistryEntry[]> => {
    return new Map(routes);
};
