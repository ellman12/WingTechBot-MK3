import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { createSchema } from 'zod-openapi';

import { RouteRegistry } from './RouteRegistry.js';

export class OpenApiGenerator {
  public generateOpenApiSpec(): Record<string, unknown> {
    const routes = RouteRegistry.getRoutes();

    return {
      openapi: '3.0.3',
      info: {
        title: 'WingTechBot MK3 API',
        version: '1.0.0',
        description:
          'A robust Discord bot API built with Express.js, TypeScript, and hexagonal architecture',
        contact: {
          name: 'WingTechBot MK3',
          url: 'https://github.com/ellman12/WingTechBot-MK3',
        },
        license: {
          name: 'ISC',
          url: 'https://opensource.org/licenses/ISC',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.wingtechbot.com',
          description: 'Production server',
        },
      ],
      tags: this.generateTags(routes),
      paths: this.generatePaths(routes),
      components: this.generateComponents(routes),
    };
  }

  private generateTags(
    routes: Array<{ tags: string[] }>
  ): Array<{ name: string; description: string }> {
    const tagSet = new Set<string>();
    routes.forEach(route => {
      route.tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).map(tag => ({
      name: tag,
      description: this.getTagDescription(tag),
    }));
  }

  private getTagDescription(tag: string): string {
    const descriptions: Record<string, string> = {
      Health: 'Health check endpoints',
      Guilds: 'Discord guild management endpoints',
      Users: 'User management endpoints',
      Commands: 'Command history endpoints',
    };
    return descriptions[tag] || `${tag} related endpoints`;
  }

  private generatePaths(routes: Array<any>): Record<string, unknown> {
    const paths: Record<string, any> = {};

    routes.forEach(route => {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      paths[route.path][route.method] = this.generateOperation(route);
    });

    return paths;
  }

  private generateOperation(route: any): Record<string, unknown> {
    const operation: any = {
      summary: route.summary,
      tags: route.tags,
      responses: this.generateResponses(route),
    };

    if (route.description) {
      operation.description = route.description;
    }

    // Add parameters for path parameters
    if (route.paramsSchema) {
      operation.parameters = this.generateParameters(route.path, route.paramsSchema);
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

  private generateParameters(path: string, paramsSchema: any): Array<any> {
    const parameters: Array<any> = [];
    const pathParams = path.match(/{([^}]+)}/g) || [];

    pathParams.forEach(param => {
      const paramName = param.slice(1, -1); // Remove { }
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          minLength: 1,
        },
        description: `${paramName} parameter`,
      });
    });

    return parameters;
  }

  private generateQueryParameters(querySchema: any): Array<any> {
    // This would need to be implemented based on the query schema structure
    return [];
  }

  private generateResponses(route: any): Record<string, unknown> {
    const responses: Record<string, any> = {};

    if (route.responseSchema) {
      responses['200'] = {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: this.zodSchemaToOpenApi(route.responseSchema),
          },
        },
      };
    } else {
      // Default success response
      if (route.method === 'post') {
        responses['201'] = {
          description: 'Created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: { type: 'object' },
                },
              },
            },
          },
        };
      } else if (route.method === 'delete') {
        responses['200'] = {
          description: 'Deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  message: { type: 'string' },
                },
              },
            },
          },
        };
      } else {
        responses['200'] = {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: { type: 'object' },
                },
              },
            },
          },
        };
      }
    }

    // Add common error responses
    responses['400'] = {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiError' },
        },
      },
    };

    if (route.path.includes('{')) {
      responses['404'] = {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      };
    }

    responses['500'] = {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiError' },
        },
      },
    };

    return responses;
  }

  private generateComponents(routes: Array<any>): Record<string, unknown> {
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

    // Add schemas from routes
    routes.forEach(route => {
      if (route.requestSchema) {
        const schemaName = `${this.capitalize(route.method)}${this.pathToSchemaName(route.path)}Request`;
        schemas[schemaName] = this.zodSchemaToOpenApi(route.requestSchema);
      }
      if (route.responseSchema) {
        const schemaName = `${this.capitalize(route.method)}${this.pathToSchemaName(route.path)}Response`;
        schemas[schemaName] = this.zodSchemaToOpenApi(route.responseSchema);
      }
    });

    return { schemas };
  }

  private zodSchemaToOpenApi(schema: any): any {
    try {
      return createSchema(schema);
    } catch (error) {
      console.warn('Failed to convert Zod schema to OpenAPI:', error);
      return { type: 'object', description: 'Schema conversion failed' };
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private pathToSchemaName(path: string): string {
    return path
      .split('/')
      .filter(Boolean)
      .map(part => part.replace(/[{}]/g, ''))
      .map(part => this.capitalize(part))
      .join('');
  }

  public setupSwaggerUI(app: Application): void {
    const openApiSpec = this.generateOpenApiSpec();

    // Serve the OpenAPI spec as JSON
    app.get('/api/docs/openapi.json', (_req, res) => {
      res.json(openApiSpec);
    });

    // Serve Swagger UI
    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(openApiSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'WingTechBot MK3 API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
        },
      })
    );

    console.log('📖 API Documentation available at:');
    console.log('   Swagger UI: http://localhost:3000/api/docs');
    console.log('   OpenAPI JSON: http://localhost:3000/api/docs/openapi.json');
  }
}
