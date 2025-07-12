import type { ApiVersion, ApiVersionConfig } from "./types.js";
import type { RouteRegistryEntry } from "./types.js";

export class RouteRegistryClass {
    private routes: Map<ApiVersion, RouteRegistryEntry[]> = new Map();
    private versionConfigs: Map<ApiVersion, ApiVersionConfig> = new Map();

    registerVersion(config: ApiVersionConfig): void {
        this.versionConfigs.set(config.version, config);

        if (!this.routes.has(config.version)) {
            this.routes.set(config.version, []);
        }

        config.routes.forEach(route => {
            const fullPath = config.basePath + route.path;

            const registryEntry: RouteRegistryEntry = { ...route, version: config.version, fullPath, basePath: config.basePath, deprecated: route.deprecated ?? config.deprecated ?? false };

            this.routes.get(config.version)?.push(registryEntry);
        });

        console.log(`✅ Registered ${config.routes.length} routes for API version ${config.version}`);
    }

    getVersionRoutes(version: ApiVersion): RouteRegistryEntry[] {
        return this.routes.get(version) || [];
    }

    getSupportedVersions(): ApiVersion[] {
        return Array.from(this.routes.keys());
    }

    getAllRoutes(): RouteRegistryEntry[] {
        const allRoutes: RouteRegistryEntry[] = [];

        this.routes.forEach(routes => {
            allRoutes.push(...routes);
        });

        return allRoutes;
    }

    getVersionConfig(version: ApiVersion): ApiVersionConfig | undefined {
        return this.versionConfigs.get(version);
    }

    getRouteByPath(method: string, path: string): RouteRegistryEntry | undefined {
        for (const routes of this.routes.values()) {
            const route = routes.find(r => r.method === method.toLowerCase() && (r.fullPath === path || r.path === path));
            if (route) return route;
        }
        return undefined;
    }

    getRoutesByTag(tag: string): RouteRegistryEntry[] {
        const taggedRoutes: RouteRegistryEntry[] = [];

        this.routes.forEach(routes => {
            routes.forEach(route => {
                if (route.tags.includes(tag)) {
                    taggedRoutes.push(route);
                }
            });
        });

        return taggedRoutes;
    }

    getDeprecatedRoutes(): RouteRegistryEntry[] {
        const deprecatedRoutes: RouteRegistryEntry[] = [];

        this.routes.forEach(routes => {
            routes.forEach(route => {
                if (route.deprecated) {
                    deprecatedRoutes.push(route);
                }
            });
        });

        return deprecatedRoutes;
    }

    validateVersionSupport(version: ApiVersion): boolean {
        const config = this.versionConfigs.get(version);
        if (!config) return false;

        const now = new Date();

        // Check if version is past sunset date
        if (config.sunsetDate && now > config.sunsetDate) {
            return false;
        }

        return true;
    }

    getVersionStatus(version: ApiVersion): "active" | "deprecated" | "sunset" | "unknown" {
        const config = this.versionConfigs.get(version);
        if (!config) return "unknown";

        const now = new Date();

        if (config.sunsetDate && now > config.sunsetDate) {
            return "sunset";
        }

        if (config.deprecated) {
            return "deprecated";
        }

        return "active";
    }

    getRoutesForDocumentation(): Map<ApiVersion, RouteRegistryEntry[]> {
        return new Map(this.routes);
    }
}

export const RouteRegistry = new RouteRegistryClass();
