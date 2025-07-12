import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import type { Application } from "express";
import swaggerUi from "swagger-ui-express";
import { z } from "zod/v4";

import { RouteRegistry } from "./api/RouteRegistry.js";
import type { RouteRegistryEntry } from "./api/types.js";

extendZodWithOpenApi(z);

export class OpenApiGenerator {
    private registry = new OpenAPIRegistry();

    public generateOpenApiSpec(): Record<string, unknown> {
        const allRoutes = RouteRegistry.getAllRoutes();
        const supportedVersions = RouteRegistry.getSupportedVersions();

        // Register all schemas from routes
        this.registerRouteSchemas(allRoutes);

        // Generate the OpenAPI document
        const generator = new OpenApiGeneratorV3(this.registry.definitions);
        const document = generator.generateDocument({
            openapi: "3.0.3",
            info: {
                title: "WingTechBot MK3 API",
                version: "multi-version",
                description: "A robust Discord bot API built with Express.js, TypeScript, and hexagonal architecture. This documentation includes all API versions.",
                contact: { name: "WingTechBot MK3", url: "https://github.com/ellman12/WingTechBot-MK3" },
                license: { name: "ISC", url: "https://opensource.org/licenses/ISC" },
                "x-api-versions": supportedVersions.map(version => {
                    const config = RouteRegistry.getVersionConfig(version);
                    return { version, basePath: config?.basePath, deprecated: config?.deprecated, deprecationDate: config?.deprecationDate?.toISOString(), sunsetDate: config?.sunsetDate?.toISOString() };
                }),
            },
            servers: this.generateServers(),
            tags: this.generateTags(allRoutes),
        });

        // Add paths manually since it's not part of the config
        const openApiSpec = document as unknown as Record<string, unknown>;
        openApiSpec.paths = this.generatePaths(allRoutes);

        return openApiSpec;
    }

    private generateServers(): Array<{ url: string; description: string }> {
        return [
            { url: "http://localhost:3000", description: "Development server - supports all API versions" },
            { url: "https://api.wingtechbot.com", description: "Production server - supports all API versions" },
        ];
    }

    private generateTags(routes: RouteRegistryEntry[]): Array<{ name: string; description?: string }> {
        const tagMap = new Map<string, { name: string; description?: string }>();

        routes.forEach(route => {
            route.tags.forEach(tag => {
                if (!tagMap.has(tag)) {
                    const tagInfo: { name: string; description?: string } = { name: tag };

                    switch (tag) {
                        case "Guilds":
                            tagInfo.description = "Discord guild management operations";
                            break;
                        case "Health":
                            tagInfo.description = "API health and status endpoints";
                            break;
                    }

                    tagMap.set(tag, tagInfo);
                }
            });
        });

        return Array.from(tagMap.values());
    }

    private generatePaths(routes: RouteRegistryEntry[]): Record<string, Record<string, unknown>> {
        const paths: Record<string, Record<string, unknown>> = {};

        routes.forEach(route => {
            if (!paths[route.fullPath]) {
                paths[route.fullPath] = {};
            }

            const pathObj = paths[route.fullPath]!;
            pathObj[route.method] = this.generateOperation(route);
        });

        return paths;
    }

    private generateOperation(route: RouteRegistryEntry): Record<string, unknown> {
        const operation: Record<string, unknown> = { summary: route.summary, tags: route.tags, responses: this.generateResponses(route), operationId: this.generateOperationId(route), parameters: [] };

        if (route.description) {
            operation.description = route.description;
        }

        if (route.deprecated) {
            operation.deprecated = true;
        }

        // Add parameters for path parameters
        if (route.paramsSchema) {
            const params = this.generateParameters(route.fullPath);
            if (params && params.length > 0) {
                (operation.parameters as Array<unknown>).push(...params);
            }
        }

        // Add query parameters
        if (route.querySchema) {
            (operation.parameters as Array<unknown>).push(...this.generateQueryParameters(route.querySchema));
        }

        // Add request body for POST/PUT/PATCH
        if (route.requestSchema && ["post", "put", "patch"].includes(route.method)) {
            const requestSchemaName = this.getSchemaName(route, "Request");
            operation.requestBody = { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${requestSchemaName}` } } } };
        }

        return operation;
    }

    private generateOperationId(route: RouteRegistryEntry): string {
        const method = route.method;
        const pathParts = route.fullPath.split("/").filter(Boolean);
        const pathString = pathParts.map(part => part.replace(/[{}]/g, "").replace(/^:/, "")).join("_");

        return `${method}_${pathString}_${route.version}`;
    }

    private generateResponses(route: RouteRegistryEntry): Record<string, Record<string, unknown>> {
        const responses: Record<string, Record<string, unknown>> = {
            "400": { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        };

        // Add success response
        if (route.responseSchema) {
            const statusCode = route.method === "post" ? "201" : "200";
            const responseSchemaName = this.getSchemaName(route, "Response");
            responses[statusCode] = { description: "Success", content: { "application/json": { schema: { $ref: `#/components/schemas/${responseSchemaName}` } } } };
        }

        // Add specific error responses based on route type
        if (route.fullPath.includes("{id}")) {
            responses["404"] = { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } };
        }

        return responses;
    }

    private generateParameters(path: string): Array<Record<string, unknown>> {
        const parameters: Array<Record<string, unknown>> = [];
        const pathParams = path.match(/{([^}]+)}/g) || [];

        pathParams.forEach(param => {
            const paramName = param.slice(1, -1);
            parameters.push({ name: paramName, in: "path", required: true, schema: { type: "string" }, description: `${paramName} parameter` });
        });

        return parameters;
    }

    private generateQueryParameters(querySchema: z.ZodTypeAny): Array<Record<string, unknown>> {
        const parameters: Array<Record<string, unknown>> = [];

        // Handle ZodObject schemas
        if (querySchema && "shape" in querySchema) {
            const shape = (querySchema as z.ZodObject<z.ZodRawShape>).shape;

            Object.entries(shape).forEach(([key, fieldSchema]) => {
                const zodSchema = fieldSchema as z.ZodTypeAny;
                const isOptional = zodSchema.isOptional();
                const type = this.getZodTypeString(zodSchema);
                const description = zodSchema.description || `${key} query parameter`;

                parameters.push({ name: key, in: "query", required: !isOptional, schema: { type }, description });
            });
        }

        return parameters;
    }

    private getZodTypeString(schema: z.ZodTypeAny): string {
        if (schema instanceof z.ZodString) return "string";
        if (schema instanceof z.ZodNumber) return "number";
        if (schema instanceof z.ZodBoolean) return "boolean";
        if (schema instanceof z.ZodArray) return "array";
        if (schema instanceof z.ZodObject) return "object";
        if (schema instanceof z.ZodEnum) return "string";
        if (schema instanceof z.ZodOptional) {
            return this.getZodTypeString((schema as z.ZodOptional<z.ZodTypeAny>)._def.innerType);
        }
        if (schema instanceof z.ZodDefault) {
            return this.getZodTypeString((schema as z.ZodDefault<z.ZodTypeAny>)._def.innerType);
        }
        if (schema instanceof z.ZodNullable) {
            return this.getZodTypeString((schema as z.ZodNullable<z.ZodTypeAny>)._def.innerType);
        }

        return "string";
    }

    private registerRouteSchemas(routes: RouteRegistryEntry[]): void {
        // Register standard error schema
        this.registry.register("ApiError", this.createApiErrorSchema());

        // Register schemas from routes
        const registeredSchemas = new Set<string>();

        routes.forEach(route => {
            // Register request schema
            if (route.requestSchema) {
                const schemaName = this.getSchemaName(route, "Request");
                if (!registeredSchemas.has(schemaName)) {
                    this.registry.register(schemaName, route.requestSchema);
                    registeredSchemas.add(schemaName);
                }
            }

            // Register response schema
            if (route.responseSchema) {
                const schemaName = this.getSchemaName(route, "Response");
                if (!registeredSchemas.has(schemaName)) {
                    this.registry.register(schemaName, route.responseSchema);
                    registeredSchemas.add(schemaName);
                }
            }

            // Register parameters schema
            if (route.paramsSchema) {
                const schemaName = this.getSchemaName(route, "Params");
                if (!registeredSchemas.has(schemaName)) {
                    this.registry.register(schemaName, route.paramsSchema);
                    registeredSchemas.add(schemaName);
                }
            }

            // Register query schema
            if (route.querySchema) {
                const schemaName = this.getSchemaName(route, "Query");
                if (!registeredSchemas.has(schemaName)) {
                    this.registry.register(schemaName, route.querySchema);
                    registeredSchemas.add(schemaName);
                }
            }
        });
    }

    private createApiErrorSchema(): z.ZodObject<z.ZodRawShape> {
        return z.object({
            success: z.literal(false),
            error: z.string().describe("Error message"),
            details: z
                .array(z.object({ path: z.string().describe("Field path"), message: z.string().describe("Error message") }))
                .optional()
                .describe("Validation error details"),
        });
    }

    private getSchemaName(route: RouteRegistryEntry, suffix: string): string {
        const method = this.capitalize(route.method);
        const pathName = this.pathToSchemaName(route.fullPath);
        return `${method}${pathName}${suffix}`;
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    private pathToSchemaName(path: string): string {
        return path
            .split("/")
            .filter(Boolean)
            .map(part => part.replace(/[{}]/g, "").replace(/^:/, ""))
            .map(part => this.capitalize(part))
            .join("");
    }

    public setupSwaggerUI(app: Application): void {
        const openApiSpec = this.generateOpenApiSpec();
        const supportedVersions = RouteRegistry.getSupportedVersions();

        // Serve the comprehensive OpenAPI spec as JSON
        app.get("/api/docs/openapi.json", (_req, res) => {
            res.json(openApiSpec);
        });

        // Setup main Swagger UI that shows all versions together
        const swaggerOptions = {
            customCss: ".swagger-ui .topbar { display: none }",
            customSiteTitle: "WingTechBot MK3 API Documentation - All Versions",
            swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, filter: true, tryItOutEnabled: true, tagsSorter: "alpha", operationsSorter: "alpha", docExpansion: "list" },
        };

        app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerOptions));

        // Setup API version overview endpoint
        app.get("/api/versions", (_req, res) => {
            const versions = supportedVersions.map(version => {
                const config = RouteRegistry.getVersionConfig(version);

                return {
                    version,
                    basePath: config?.basePath,
                    deprecated: config?.deprecated,
                    deprecationDate: config?.deprecationDate?.toISOString(),
                    sunsetDate: config?.sunsetDate?.toISOString(),
                    routeCount: RouteRegistry.getVersionRoutes(version).length,
                    endpoints: RouteRegistry.getVersionRoutes(version).map(route => ({ method: route.method.toUpperCase(), path: route.fullPath, summary: route.summary, deprecated: route.deprecated })),
                };
            });

            res.json({ title: "WingTechBot MK3 API Versions", totalVersions: versions.length, versions });
        });

        console.log("📖 API Documentation available at:");
        console.log("   📚 All Versions Swagger UI: http://localhost:3000/api/docs");
        console.log("   📋 OpenAPI JSON: http://localhost:3000/api/docs/openapi.json");
        console.log("   🔍 Version Overview: http://localhost:3000/api/versions");

        supportedVersions.forEach(version => {
            const versionConfig = RouteRegistry.getVersionConfig(version);
            const routes = RouteRegistry.getVersionRoutes(version);
            console.log(`   📌 ${version.toUpperCase()}: ${routes.length} endpoints at ${versionConfig?.basePath}${versionConfig?.deprecated ? " (DEPRECATED)" : ""}`);
        });
    }
}
