import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { OpenAPIGenerator } from 'zod-to-openapi';

import { VersionedRouteRegistry } from './api/VersionedRouteRegistry.js';
import type { VersionedRouteRegistryEntry } from './api/types.js';

export class VersionedOpenApiGenerator {
  public generateOpenApiSpec(): Record<string, unknown> {
    const allRoutes = VersionedRouteRegistry.getAllRoutes();
    const supportedVersions = VersionedRouteRegistry.getSupportedVersions();

    return {
      openapi: '3.0.3',
      info: {
        title: 'WingTechBot MK3 API',
        version: 'multi-version',
        description:
          'A robust Discord bot API built with Express.js, TypeScript, and hexagonal architecture. This documentation includes all API versions.',
        contact: {
          name: 'WingTechBot MK3',
          url: 'https://github.com/ellman12/WingTechBot-MK3',
        },
        license: {
          name: 'ISC',
          url: 'https://opensource.org/licenses/ISC',
        },
        'x-api-versions': supportedVersions.map(version => {
          const config = VersionedRouteRegistry.getVersionConfig(version);
          return {
            version,
            basePath: config?.basePath,
            deprecated: config?.deprecated,
            deprecationDate: config?.deprecationDate?.toISOString(),
            sunsetDate: config?.sunsetDate?.toISOString(),
          };
        }),
      },
      servers: this.generateServers(),
      tags: this.generateTags(allRoutes),
      paths: this.generatePaths(allRoutes),
      components: this.generateComponents(allRoutes),
    };
  }

  private generateServers(): Array<Record<string, unknown>> {
    return [
      {
        url: 'http://localhost:3000',
        description: 'Development server - supports all API versions',
      },
      {
        url: 'https://api.wingtechbot.com',
        description: 'Production server - supports all API versions',
      },
    ];
  }

  private generateTags(routes: VersionedRouteRegistryEntry[]): Array<Record<string, unknown>> {
    const tagMap = new Map<string, { name: string; description?: string }>();

    routes.forEach(route => {
      route.tags.forEach(tag => {
        if (!tagMap.has(tag)) {
          const tagInfo: { name: string; description?: string } = { name: tag };

          switch (tag) {
            case 'Guilds':
              tagInfo.description = 'Discord guild management operations';
              break;
            case 'Health':
              tagInfo.description = 'API health and status endpoints';
              break;
          }

          tagMap.set(tag, tagInfo);
        }
      });
    });

    return Array.from(tagMap.values());
  }

  private generatePaths(routes: VersionedRouteRegistryEntry[]): Record<string, unknown> {
    const paths: Record<string, any> = {};

    routes.forEach(route => {
      if (!paths[route.fullPath]) {
        paths[route.fullPath] = {};
      }

      paths[route.fullPath][route.method] = this.generateOperation(route);
    });

    return paths;
  }

  private generateOperation(route: VersionedRouteRegistryEntry): Record<string, unknown> {
    const operation: any = {
      summary: route.summary,
      tags: route.tags,
      responses: this.generateResponses(route),
      operationId: this.generateOperationId(route),
    };

    if (route.description) {
      operation.description = route.description;
    }

    if (route.deprecated) {
      operation.deprecated = true;
    }

    // Add parameters for path parameters
    if (route.paramsSchema) {
      operation.parameters = this.generateParameters(route.fullPath, route.paramsSchema);
    }

    // Add query parameters
    if (route.querySchema) {
      if (!operation.parameters) operation.parameters = [];
      operation.parameters.push(...this.generateQueryParameters(route.querySchema));
    }

    // Add request body for POST/PUT/PATCH
    if (route.requestSchema && ['post', 'put', 'patch'].includes(route.method)) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: this.zodSchemaToOpenApi(route.requestSchema),
          },
        },
      };
    }

    return operation;
  }

  private generateOperationId(route: VersionedRouteRegistryEntry): string {
    const method = route.method;
    const pathParts = route.fullPath.split('/').filter(Boolean);
    const pathString = pathParts.map(part => part.replace(/[{}]/g, '').replace(/^:/, '')).join('_');

    return `${method}_${pathString}_${route.version}`;
  }

  private generateResponses(route: VersionedRouteRegistryEntry): Record<string, unknown> {
    const responses: Record<string, any> = {
      '400': {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      '500': {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    };

    // Add success response
    if (route.responseSchema) {
      const statusCode = route.method === 'post' ? '201' : '200';
      responses[statusCode] = {
        description: 'Success',
        content: {
          'application/json': {
            schema: this.zodSchemaToOpenApi(route.responseSchema),
          },
        },
      };
    }

    // Add specific error responses based on route type
    if (route.fullPath.includes('{id}')) {
      responses['404'] = {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      };
    }

    return responses;
  }

  private generateParameters(path: string, paramsSchema: any): Array<Record<string, unknown>> {
    const parameters: Array<Record<string, unknown>> = [];
    const pathParams = path.match(/{([^}]+)}/g) || [];

    pathParams.forEach(param => {
      const paramName = param.slice(1, -1);
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        schema: {
          type: 'string',
        },
        description: `${paramName} parameter`,
      });
    });

    return parameters;
  }

  private generateQueryParameters(querySchema: any): Array<Record<string, unknown>> {
    // This is a simplified implementation
    // In a real scenario, you'd want to parse the Zod schema properly
    return [];
  }

  private zodSchemaToOpenApi(schema: any): Record<string, unknown> {
    // Use zod-to-openapi for real conversion
    const generator = new OpenAPIGenerator([schema]);
    const schemas = generator.generate();
    // Return the first schema (or you can use a name if you register with one)
    return Object.values(schemas)[0] as Record<string, unknown>;
  }

  private generateComponents(routes: VersionedRouteRegistryEntry[]): Record<string, unknown> {
    const schemas: Record<string, any> = {
      ApiError: {
        type: 'object',
        description: 'Standard API error response',
        properties: {
          success: {
            type: 'boolean',
            enum: [false],
          },
          error: {
            type: 'string',
            description: 'Error message',
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Field path',
                },
                message: {
                  type: 'string',
                  description: 'Error message',
                },
              },
              required: ['path', 'message'],
            },
            description: 'Validation error details',
          },
        },
        required: ['success', 'error'],
      },
    };

    return { schemas };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private pathToSchemaName(path: string): string {
    return path
      .split('/')
      .filter(Boolean)
      .map(part => part.replace(/[{}]/g, '').replace(/^:/, ''))
      .map(part => this.capitalize(part))
      .join('');
  }

  public setupSwaggerUI(app: Application): void {
    const openApiSpec = this.generateOpenApiSpec();
    const supportedVersions = VersionedRouteRegistry.getSupportedVersions();

    // Serve the comprehensive OpenAPI spec as JSON
    app.get('/api/docs/openapi.json', (_req, res) => {
      res.json(openApiSpec);
    });

    // Setup main Swagger UI that shows all versions together
    const swaggerOptions = {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'WingTechBot MK3 API Documentation - All Versions',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'list',
      },
    };

    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerOptions));

    // Setup API version overview endpoint
    app.get('/api/versions', (_req, res) => {
      const versions = supportedVersions.map(version => {
        const config = VersionedRouteRegistry.getVersionConfig(version);
        const routes = VersionedRouteRegistry.getVersionRoutes(version);

        return {
          version,
          basePath: config?.basePath,
          deprecated: config?.deprecated,
          deprecationDate: config?.deprecationDate?.toISOString(),
          sunsetDate: config?.sunsetDate?.toISOString(),
          routeCount: routes.length,
          endpoints: routes.map(route => ({
            method: route.method.toUpperCase(),
            path: route.fullPath,
            summary: route.summary,
            deprecated: route.deprecated,
          })),
        };
      });

      res.json({
        title: 'WingTechBot MK3 API Versions',
        totalVersions: versions.length,
        versions,
      });
    });

    console.log('📖 API Documentation available at:');
    console.log('   📚 All Versions Swagger UI: http://localhost:3000/api/docs');
    console.log('   📋 OpenAPI JSON: http://localhost:3000/api/docs/openapi.json');
    console.log('   🔍 Version Overview: http://localhost:3000/api/versions');

    supportedVersions.forEach(version => {
      const versionConfig = VersionedRouteRegistry.getVersionConfig(version);
      const routes = VersionedRouteRegistry.getVersionRoutes(version);
      console.log(
        `   📌 ${version.toUpperCase()}: ${routes.length} endpoints at ${versionConfig?.basePath}${versionConfig?.deprecated ? ' (DEPRECATED)' : ''}`
      );
    });
  }
}
