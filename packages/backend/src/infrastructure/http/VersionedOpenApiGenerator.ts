import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import type { Application } from "express";
import swaggerUi from "swagger-ui-express";
import { z } from "zod/v4";

import { VersionedRouteRegistry } from "./api/VersionedRouteRegistry.js";
import type { VersionedRouteRegistryEntry } from "./api/types.js";

extendZodWithOpenApi(z);

// Type definitions for Zod schema handling
type ZodSchemaType = unknown;
type ZodCheck = { kind: string; value?: number; message?: string; inclusive?: boolean };
type ZodDef = { typeName?: string; checks?: ZodCheck[]; minLength?: { value: number }; maxLength?: { value: number }; type?: unknown; values?: unknown[]; innerType?: unknown; defaultValue?: () => unknown; options?: unknown[] };

export class VersionedOpenApiGenerator {
    public generateOpenApiSpec(): Record<string, unknown> {
        const allRoutes = VersionedRouteRegistry.getAllRoutes();
        const supportedVersions = VersionedRouteRegistry.getSupportedVersions();

        return {
            openapi: "3.0.3",
            info: {
                title: "WingTechBot MK3 API",
                version: "multi-version",
                description: "A robust Discord bot API built with Express.js, TypeScript, and hexagonal architecture. This documentation includes all API versions.",
                contact: { name: "WingTechBot MK3", url: "https://github.com/ellman12/WingTechBot-MK3" },
                license: { name: "ISC", url: "https://opensource.org/licenses/ISC" },
                "x-api-versions": supportedVersions.map(version => {
                    const config = VersionedRouteRegistry.getVersionConfig(version);
                    return { version, basePath: config?.basePath, deprecated: config?.deprecated, deprecationDate: config?.deprecationDate?.toISOString(), sunsetDate: config?.sunsetDate?.toISOString() };
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
            { url: "http://localhost:3000", description: "Development server - supports all API versions" },
            { url: "https://api.wingtechbot.com", description: "Production server - supports all API versions" },
        ];
    }

    private generateTags(routes: VersionedRouteRegistryEntry[]): Array<Record<string, unknown>> {
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

    private generatePaths(routes: VersionedRouteRegistryEntry[]): Record<string, Record<string, unknown>> {
        const paths: Record<string, Record<string, unknown>> = {};

        routes.forEach(route => {
            if (!paths[route.fullPath]) {
                paths[route.fullPath] = {};
            }
            // Add a type guard to satisfy the linter
            const pathObj = paths[route.fullPath]!;
            pathObj[route.method] = this.generateOperation(route);
        });

        return paths;
    }

    private generateOperation(route: VersionedRouteRegistryEntry): Record<string, unknown> {
        const operation: Record<string, unknown> = { summary: route.summary, tags: route.tags, responses: this.generateResponses(route), operationId: this.generateOperationId(route), parameters: [] };

        if (route.description) {
            operation.description = route.description;
        }

        if (route.deprecated) {
            operation.deprecated = true;
        }

        // Add parameters for path parameters
        if (route.paramsSchema) {
            const params = this.generateParameters(route.fullPath, route.paramsSchema);
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
            operation.requestBody = { required: true, content: { "application/json": { schema: this.zodSchemaToOpenApi(route.requestSchema) } } };
        }

        return operation;
    }

    private generateOperationId(route: VersionedRouteRegistryEntry): string {
        const method = route.method;
        const pathParts = route.fullPath.split("/").filter(Boolean);
        const pathString = pathParts.map(part => part.replace(/[{}]/g, "").replace(/^:/, "")).join("_");

        return `${method}_${pathString}_${route.version}`;
    }

    private generateResponses(route: VersionedRouteRegistryEntry): Record<string, Record<string, unknown>> {
        const responses: Record<string, Record<string, unknown>> = {
            "400": { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
            "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        };

        // Add success response
        if (route.responseSchema) {
            const statusCode = route.method === "post" ? "201" : "200";
            responses[statusCode] = { description: "Success", content: { "application/json": { schema: this.zodSchemaToOpenApi(route.responseSchema) } } };
        }

        // Add specific error responses based on route type
        if (route.fullPath.includes("{id}")) {
            responses["404"] = { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } };
        }

        return responses;
    }

    private generateParameters(path: string, paramsSchema: z.ZodTypeAny): Array<Record<string, unknown>> {
        const parameters: Array<Record<string, unknown>> = [];
        const pathParams = path.match(/{([^}]+)}/g) || [];

        // Generate parameters from path
        pathParams.forEach(param => {
            const paramName = param.slice(1, -1);
            let paramType = "string";
            let paramDescription = `${paramName} parameter`;

            // Try to extract type information from the schema if it's a ZodObject
            if (paramsSchema && "shape" in paramsSchema) {
                const shape = (paramsSchema as z.ZodObject<z.ZodRawShape>).shape;
                if (shape[paramName]) {
                    const fieldSchema = shape[paramName] as ZodSchemaType;
                    paramType = this.getZodTypeString(fieldSchema);
                    paramDescription = this.getZodDescription(fieldSchema) || paramDescription;
                }
            }

            parameters.push({ name: paramName, in: "path", required: true, schema: { type: paramType }, description: paramDescription });
        });

        return parameters;
    }

    private generateQueryParameters(querySchema: z.ZodTypeAny): Array<Record<string, unknown>> {
        const parameters: Array<Record<string, unknown>> = [];

        // Handle ZodObject schemas
        if (querySchema && "shape" in querySchema) {
            const shape = (querySchema as z.ZodObject<z.ZodRawShape>).shape;

            Object.entries(shape).forEach(([key, fieldSchema]) => {
                const zodSchema = fieldSchema as ZodSchemaType;
                const isOptional = this.isOptionalSchema(zodSchema);
                const type = this.getZodTypeString(zodSchema);
                const description = this.getZodDescription(zodSchema) || `${key} query parameter`;

                parameters.push({ name: key, in: "query", required: !isOptional, schema: { type, ...this.getZodSchemaConstraints(zodSchema) }, description });
            });
        }

        return parameters;
    }

    private getZodTypeString(schema: ZodSchemaType): string {
        // Use safer type checking with instanceof and type guards
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

        // Fallback to string for unknown types
        return "string";
    }

    private getZodDescription(schema: ZodSchemaType): string | undefined {
        if (schema && typeof schema === "object" && "description" in schema) {
            return (schema as { description?: string }).description;
        }
        return undefined;
    }

    private isOptionalSchema(schema: ZodSchemaType): boolean {
        if (schema && typeof schema === "object" && "isOptional" in schema) {
            const isOptionalFn = (schema as { isOptional: () => boolean }).isOptional;
            if (typeof isOptionalFn === "function") {
                return isOptionalFn();
            }
        }
        return false;
    }

    private getZodSchemaConstraints(schema: ZodSchemaType): Record<string, unknown> {
        const constraints: Record<string, unknown> = {};

        // Handle string constraints
        if (schema instanceof z.ZodString) {
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                const checks = def.checks || [];
                checks.forEach((check: ZodCheck) => {
                    switch (check.kind) {
                        case "min":
                            constraints.minLength = check.value;
                            break;
                        case "max":
                            constraints.maxLength = check.value;
                            break;
                        case "email":
                            constraints.format = "email";
                            break;
                        case "url":
                            constraints.format = "uri";
                            break;
                        case "uuid":
                            constraints.format = "uuid";
                            break;
                    }
                });
            } catch {
                // Ignore errors accessing internal properties
            }
        }

        // Handle number constraints
        if (schema instanceof z.ZodNumber) {
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                const checks = def.checks || [];
                checks.forEach((check: ZodCheck) => {
                    switch (check.kind) {
                        case "min":
                            constraints.minimum = check.value;
                            if (!check.inclusive) {
                                constraints.exclusiveMinimum = true;
                            }
                            break;
                        case "max":
                            constraints.maximum = check.value;
                            if (!check.inclusive) {
                                constraints.exclusiveMaximum = true;
                            }
                            break;
                        case "int":
                            constraints.type = "integer";
                            break;
                    }
                });
            } catch {
                // Ignore errors accessing internal properties
            }
        }

        // Handle array constraints
        if (schema instanceof z.ZodArray) {
            constraints.type = "array";
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                if (def.minLength) {
                    constraints.minItems = def.minLength.value;
                }
                if (def.maxLength) {
                    constraints.maxItems = def.maxLength.value;
                }
                if (def.type) {
                    constraints.items = { type: this.getZodTypeString(def.type) };
                }
            } catch {
                // Ignore errors accessing internal properties
            }
        }

        // Handle enum constraints
        if (schema instanceof z.ZodEnum) {
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                constraints.enum = def.values;
            } catch {
                // Ignore errors accessing internal properties
            }
        }

        // Handle default values
        if (schema instanceof z.ZodDefault) {
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                if (def.defaultValue) {
                    constraints.default = def.defaultValue();
                }
            } catch {
                // Ignore errors accessing internal properties
            }
        }

        return constraints;
    }

    private zodSchemaToOpenApi(schema: z.ZodSchema): Record<string, unknown> {
        try {
            // Create a registry and register the schema
            const registry = new OpenAPIRegistry();

            // Use a more descriptive name for the schema
            const schemaName = `Schema_${Date.now()}`;
            registry.register(schemaName, schema);

            // Generate the OpenAPI components
            const generator = new OpenApiGeneratorV3(registry.definitions);
            const components = generator.generateComponents();

            // Extract the schema from the components
            const schemas = (components as { schemas?: Record<string, Record<string, unknown>> }).schemas;

            if (schemas && schemas[schemaName]) {
                return schemas[schemaName];
            }

            // Fallback: manual schema conversion
            return this.convertZodSchemaManually(schema);
        } catch (error) {
            console.warn("Failed to convert Zod schema to OpenAPI:", error);
            // Fallback to manual conversion
            return this.convertZodSchemaManually(schema);
        }
    }

    private convertZodSchemaManually(schema: ZodSchemaType): Record<string, unknown> {
        // Use instanceof checks instead of accessing _def.typeName
        if (schema instanceof z.ZodObject) {
            const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
            const properties: Record<string, Record<string, unknown>> = {};
            const required: string[] = [];

            Object.entries(shape).forEach(([key, fieldSchema]) => {
                const zodSchema = fieldSchema as ZodSchemaType;
                properties[key] = this.convertZodSchemaManually(zodSchema);

                if (!this.isOptionalSchema(zodSchema)) {
                    required.push(key);
                }
            });

            return { type: "object", properties, ...(required.length > 0 && { required }) };
        }

        if (schema instanceof z.ZodArray) {
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                const elementType = def.type;
                if (elementType) {
                    return { type: "array", items: this.convertZodSchemaManually(elementType), ...(def.minLength && { minItems: def.minLength.value }), ...(def.maxLength && { maxItems: def.maxLength.value }) };
                }
            } catch {
                // Fallback handled below
            }
            return { type: "array", items: { type: "string" } };
        }

        if (schema instanceof z.ZodString) {
            const result: Record<string, unknown> = { type: "string" };
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                const checks = def.checks || [];

                checks.forEach((check: ZodCheck) => {
                    switch (check.kind) {
                        case "min":
                            result.minLength = check.value;
                            break;
                        case "max":
                            result.maxLength = check.value;
                            break;
                        case "email":
                            result.format = "email";
                            break;
                        case "url":
                            result.format = "uri";
                            break;
                        case "uuid":
                            result.format = "uuid";
                            break;
                    }
                });
            } catch {
                // Ignore errors accessing internal properties
            }
            return result;
        }

        if (schema instanceof z.ZodNumber) {
            const result: Record<string, unknown> = { type: "number" };
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                const checks = def.checks || [];

                checks.forEach((check: ZodCheck) => {
                    switch (check.kind) {
                        case "min":
                            result.minimum = check.value;
                            if (!check.inclusive) {
                                result.exclusiveMinimum = true;
                            }
                            break;
                        case "max":
                            result.maximum = check.value;
                            if (!check.inclusive) {
                                result.exclusiveMaximum = true;
                            }
                            break;
                        case "int":
                            result.type = "integer";
                            break;
                    }
                });
            } catch {
                // Ignore errors accessing internal properties
            }
            return result;
        }

        if (schema instanceof z.ZodBoolean) {
            return { type: "boolean" };
        }

        if (schema instanceof z.ZodEnum) {
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                return { type: "string", enum: def.values };
            } catch {
                return { type: "string" };
            }
        }

        if (schema instanceof z.ZodOptional) {
            return this.convertZodSchemaManually((schema as z.ZodOptional<z.ZodTypeAny>)._def.innerType);
        }

        if (schema instanceof z.ZodDefault) {
            try {
                const innerSchema = this.convertZodSchemaManually((schema as z.ZodDefault<z.ZodTypeAny>)._def.innerType);
                const def = (schema as unknown as { _def: ZodDef })._def;
                if (def.defaultValue) {
                    return { ...innerSchema, default: def.defaultValue() };
                }
                return innerSchema;
            } catch {
                return this.convertZodSchemaManually((schema as z.ZodDefault<z.ZodTypeAny>)._def.innerType);
            }
        }

        if (schema instanceof z.ZodNullable) {
            const innerSchema = this.convertZodSchemaManually((schema as z.ZodNullable<z.ZodTypeAny>)._def.innerType);
            return { ...innerSchema, nullable: true };
        }

        if (schema instanceof z.ZodUnion) {
            try {
                const def = (schema as unknown as { _def: ZodDef })._def;
                const options = def.options;
                if (options && Array.isArray(options)) {
                    return { oneOf: options.map((option: ZodSchemaType) => this.convertZodSchemaManually(option)) };
                }
            } catch {
                // Fallback handled below
            }
            return { type: "object", properties: {}, additionalProperties: true };
        }

        // Default fallback
        return { type: "object", properties: {}, additionalProperties: true };
    }

    private generateComponents(routes: VersionedRouteRegistryEntry[]): Record<string, unknown> {
        const schemas: Record<string, Record<string, unknown>> = {
            ApiError: {
                type: "object",
                description: "Standard API error response",
                properties: {
                    success: { type: "boolean", enum: [false] },
                    error: { type: "string", description: "Error message" },
                    details: {
                        type: "array",
                        items: { type: "object", properties: { path: { type: "string", description: "Field path" }, message: { type: "string", description: "Error message" } }, required: ["path", "message"] },
                        description: "Validation error details",
                    },
                },
                required: ["success", "error"],
            },
        };

        // Generate schemas from route schemas
        const schemaNames = new Set<string>();

        routes.forEach(route => {
            // Generate schema for request body
            if (route.requestSchema) {
                const schemaName = `${this.capitalize(route.method)}${this.pathToSchemaName(route.fullPath)}Request`;
                if (!schemaNames.has(schemaName)) {
                    schemas[schemaName] = this.zodSchemaToOpenApi(route.requestSchema);
                    schemaNames.add(schemaName);
                }
            }

            // Generate schema for response body
            if (route.responseSchema) {
                const schemaName = `${this.capitalize(route.method)}${this.pathToSchemaName(route.fullPath)}Response`;
                if (!schemaNames.has(schemaName)) {
                    schemas[schemaName] = this.zodSchemaToOpenApi(route.responseSchema);
                    schemaNames.add(schemaName);
                }
            }

            // Generate schema for parameters
            if (route.paramsSchema) {
                const schemaName = `${this.pathToSchemaName(route.fullPath)}Params`;
                if (!schemaNames.has(schemaName)) {
                    schemas[schemaName] = this.zodSchemaToOpenApi(route.paramsSchema);
                    schemaNames.add(schemaName);
                }
            }

            // Generate schema for query parameters
            if (route.querySchema) {
                const schemaName = `${this.capitalize(route.method)}${this.pathToSchemaName(route.fullPath)}Query`;
                if (!schemaNames.has(schemaName)) {
                    schemas[schemaName] = this.zodSchemaToOpenApi(route.querySchema);
                    schemaNames.add(schemaName);
                }
            }
        });

        return { schemas };
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
        const supportedVersions = VersionedRouteRegistry.getSupportedVersions();

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
                const config = VersionedRouteRegistry.getVersionConfig(version);
                // const routes = VersionedRouteRegistry.getVersionRoutes(version);

                return {
                    version,
                    basePath: config?.basePath,
                    deprecated: config?.deprecated,
                    deprecationDate: config?.deprecationDate?.toISOString(),
                    sunsetDate: config?.sunsetDate?.toISOString(),
                    routeCount: VersionedRouteRegistry.getVersionRoutes(version).length,
                    endpoints: VersionedRouteRegistry.getVersionRoutes(version).map(route => ({ method: route.method.toUpperCase(), path: route.fullPath, summary: route.summary, deprecated: route.deprecated })),
                };
            });

            res.json({ title: "WingTechBot MK3 API Versions", totalVersions: versions.length, versions });
        });

        console.log("📖 API Documentation available at:");
        console.log("   📚 All Versions Swagger UI: http://localhost:3000/api/docs");
        console.log("   📋 OpenAPI JSON: http://localhost:3000/api/docs/openapi.json");
        console.log("   🔍 Version Overview: http://localhost:3000/api/versions");

        supportedVersions.forEach(version => {
            const versionConfig = VersionedRouteRegistry.getVersionConfig(version);
            const routes = VersionedRouteRegistry.getVersionRoutes(version);
            console.log(`   📌 ${version.toUpperCase()}: ${routes.length} endpoints at ${versionConfig?.basePath}${versionConfig?.deprecated ? " (DEPRECATED)" : ""}`);
        });
    }
}
