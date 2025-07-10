import type {
  ApiVersion,
  ApiVersionConfiguration,
  VersionConfig,
  VersionedRouteRegistryEntry,
} from './types.js';

export class VersionedRouteRegistryClass {
  private routes: Map<ApiVersion, VersionedRouteRegistryEntry[]> = new Map();
  private versionConfigs: Map<ApiVersion, VersionConfig> = new Map();

  /**
   * Register an entire API version configuration
   */
  registerVersion(versionConfig: ApiVersionConfiguration): void {
    const { config, groups } = versionConfig;
    this.versionConfigs.set(config.version, config);

    if (!this.routes.has(config.version)) {
      this.routes.set(config.version, []);
    }

    const versionRoutes = this.routes.get(config.version)!;

    groups.forEach(group => {
      group.routes.forEach(route => {
        const fullPath = `${config.basePath}${group.basePath}${route.path}`;

        const registryEntry: VersionedRouteRegistryEntry = {
          ...route,
          version: config.version,
          fullPath,
          tags: group.tags ? [...group.tags, ...route.tags] : route.tags,
        };

        versionRoutes.push(registryEntry);
      });
    });
  }

  /**
   * Get all routes for a specific version
   */
  getVersionRoutes(version: ApiVersion): VersionedRouteRegistryEntry[] {
    return this.routes.get(version) || [];
  }

  /**
   * Get all routes across all versions
   */
  getAllRoutes(): VersionedRouteRegistryEntry[] {
    const allRoutes: VersionedRouteRegistryEntry[] = [];
    this.routes.forEach(routes => allRoutes.push(...routes));
    return allRoutes;
  }

  /**
   * Get version configuration
   */
  getVersionConfig(version: ApiVersion): VersionConfig | undefined {
    return this.versionConfigs.get(version);
  }

  /**
   * Get all supported versions
   */
  getSupportedVersions(): ApiVersion[] {
    return Array.from(this.versionConfigs.keys());
  }

  /**
   * Check if a version is deprecated
   */
  isVersionDeprecated(version: ApiVersion): boolean {
    const config = this.versionConfigs.get(version);
    return config?.deprecated === true;
  }

  /**
   * Get deprecation info for a version
   */
  getDeprecationInfo(version: ApiVersion): {
    deprecated: boolean;
    deprecationDate?: Date;
    sunsetDate?: Date;
  } {
    const config = this.versionConfigs.get(version);
    const result: { deprecated: boolean; deprecationDate?: Date; sunsetDate?: Date } = {
      deprecated: config?.deprecated === true,
    };

    if (config?.deprecationDate) {
      result.deprecationDate = config.deprecationDate;
    }

    if (config?.sunsetDate) {
      result.sunsetDate = config.sunsetDate;
    }

    return result;
  }

  /**
   * Clear all routes (useful for testing)
   */
  clear(): void {
    this.routes.clear();
    this.versionConfigs.clear();
  }

  /**
   * Get routes grouped by version for documentation generation
   */
  getRoutesForDocumentation(): Map<ApiVersion, VersionedRouteRegistryEntry[]> {
    return new Map(this.routes);
  }
}

export const VersionedRouteRegistry = new VersionedRouteRegistryClass();
