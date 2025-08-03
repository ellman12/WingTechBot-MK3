import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import type { Application } from "express";
import swaggerUi from "swagger-ui-express";
import { z } from "zod/v4";

import { getConfig } from "../config/Config.js";
import { getAllRoutes } from "./api/RouteRegistry.js";
import type { RouteRegistryEntry } from "./api/types.js";

extendZodWithOpenApi(z);

const config = getConfig();

let registryInstance: OpenAPIRegistry | null = null;

const getRegistry = (): OpenAPIRegistry => {
    if (!registryInstance) {
        registryInstance = new OpenAPIRegistry();
    }
    return registryInstance;
};

const generateServers = (): Array<{ url: string; description: string }> => {
    return [{ url: `http://localhost:${config.server.port}`, description: "Development server" }];
};

const generateTags = (routes: RouteRegistryEntry[]): Array<{ name: string; description?: string }> => {
    const tagMap = new Map<string, { name: string; description?: string }>();

    routes.forEach(route => {
        route.tags.forEach(tag => {
            if (!tagMap.has(tag)) {
                const tagInfo: { name: string; description?: string } = { name: tag };

                switch (tag) {
                    case "Health":
                        tagInfo.description = "API health and status endpoints";
                        break;
                }

                tagMap.set(tag, tagInfo);
            }
        });
    });

    return Array.from(tagMap.values());
};

const generatePaths = (routes: RouteRegistryEntry[]): Record<string, Record<string, unknown>> => {
    const paths: Record<string, Record<string, unknown>> = {};

    routes.forEach(route => {
        if (!paths[route.fullPath]) {
            paths[route.fullPath] = {};
        }

        const pathObj = paths[route.fullPath]!;
        pathObj[route.method] = generateOperation(route);
    });

    return paths;
};

const generateOperation = (route: RouteRegistryEntry): Record<string, unknown> => {
    const operation: Record<string, unknown> = { summary: route.summary, tags: route.tags, responses: generateResponses(route), operationId: generateOperationId(route), parameters: [] };

    if (route.description) {
        operation.description = route.description;
    }

    if (route.deprecated) {
        operation.deprecated = true;
    }

    if (route.paramsSchema) {
        const params = generateParameters(route.fullPath);
        if (params && params.length > 0) {
            (operation.parameters as Array<unknown>).push(...params);
        }
    }

    if (route.querySchema) {
        (operation.parameters as Array<unknown>).push(...generateQueryParameters(route.querySchema));
    }

    if (route.requestSchema && ["post", "put", "patch"].includes(route.method)) {
        const requestSchemaName = getSchemaName(route, "Request");
        operation.requestBody = { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${requestSchemaName}` } } } };
    }

    return operation;
};

const generateOperationId = (route: RouteRegistryEntry): string => {
    const method = route.method;
    const pathParts = route.fullPath.split("/").filter(Boolean);
    const pathString = pathParts.map(part => part.replace(/[{}]/g, "").replace(/^:/, "")).join("_");

    return `${method}_${pathString}_${route.version}`;
};

const generateResponses = (route: RouteRegistryEntry): Record<string, Record<string, unknown>> => {
    const responses: Record<string, Record<string, unknown>> = {
        "400": { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
    };

    if (route.responseSchema) {
        const statusCode = route.method === "post" ? "201" : "200";
        const responseSchemaName = getSchemaName(route, "Response");
        responses[statusCode] = { description: "Success", content: { "application/json": { schema: { $ref: `#/components/schemas/${responseSchemaName}` } } } };
    }

    if (route.fullPath.includes("{id}")) {
        responses["404"] = { description: "Not Found", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } };
    }

    return responses;
};

const generateParameters = (path: string): Array<Record<string, unknown>> => {
    const parameters: Array<Record<string, unknown>> = [];
    const pathParams = path.match(/{([^}]+)}/g) || [];

    pathParams.forEach(param => {
        const paramName = param.slice(1, -1);
        parameters.push({ name: paramName, in: "path", required: true, schema: { type: "string" }, description: `${paramName} parameter` });
    });

    return parameters;
};

const generateQueryParameters = (querySchema: z.ZodTypeAny): Array<Record<string, unknown>> => {
    const parameters: Array<Record<string, unknown>> = [];

    if (querySchema && "shape" in querySchema) {
        const shape = (querySchema as z.ZodObject<z.ZodRawShape>).shape;

        Object.entries(shape).forEach(([key, fieldSchema]) => {
            const zodSchema = fieldSchema as z.ZodTypeAny;
            const isOptional = zodSchema.isOptional();
            const type = getZodTypeString(zodSchema);
            const description = zodSchema.description || `${key} query parameter`;

            parameters.push({ name: key, in: "query", required: !isOptional, schema: { type }, description });
        });
    }

    return parameters;
};

const getZodTypeString = (schema: z.ZodTypeAny): string => {
    if (schema instanceof z.ZodString) return "string";
    if (schema instanceof z.ZodNumber) return "number";
    if (schema instanceof z.ZodBoolean) return "boolean";
    if (schema instanceof z.ZodArray) return "array";
    if (schema instanceof z.ZodObject) return "object";
    if (schema instanceof z.ZodEnum) return "string";
    if (schema instanceof z.ZodOptional) {
        return getZodTypeString((schema as z.ZodOptional<z.ZodTypeAny>)._def.innerType);
    }
    if (schema instanceof z.ZodDefault) {
        return getZodTypeString((schema as z.ZodDefault<z.ZodTypeAny>)._def.innerType);
    }
    if (schema instanceof z.ZodNullable) {
        return getZodTypeString((schema as z.ZodNullable<z.ZodTypeAny>)._def.innerType);
    }

    return "string";
};

const registerRouteSchemas = (routes: RouteRegistryEntry[]): void => {
    const registry = getRegistry();

    registry.register("ApiError", createApiErrorSchema());

    const registeredSchemas = new Set<string>();

    routes.forEach(route => {
        if (route.requestSchema) {
            const schemaName = getSchemaName(route, "Request");
            if (!registeredSchemas.has(schemaName)) {
                registry.register(schemaName, route.requestSchema);
                registeredSchemas.add(schemaName);
            }
        }

        if (route.responseSchema) {
            const schemaName = getSchemaName(route, "Response");
            if (!registeredSchemas.has(schemaName)) {
                registry.register(schemaName, route.responseSchema);
                registeredSchemas.add(schemaName);
            }
        }
    });
};

const createApiErrorSchema = (): z.ZodObject<z.ZodRawShape> => {
    return z.object({
        error: z.string(),
        message: z.string(),
        statusCode: z.number(),
        timestamp: z.string(),
    });
};

const getSchemaName = (route: RouteRegistryEntry, suffix: string): string => {
    const pathName = pathToSchemaName(route.fullPath);
    return `${capitalize(pathName)}${suffix}`;
};

const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const pathToSchemaName = (path: string): string => {
    return path
        .split("/")
        .filter(Boolean)
        .map(part => part.replace(/[{}]/g, "").replace(/^:/, ""))
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
};

export const generateOpenApiSpec = (): Record<string, unknown> => {
    const routes = getAllRoutes();

    registerRouteSchemas(routes);

    const registry = getRegistry();
    const generator = new OpenApiGeneratorV3(registry.definitions);

    const spec = generator.generateDocument({
        openapi: "3.0.3",
        info: {
            title: "WingTechBot MK3 API",
            version: "1.0.0",
            description: "API for WingTechBot MK3 Discord bot",
        },
        servers: generateServers(),
        tags: generateTags(routes),
    });

    const openApiSpec = spec as unknown as Record<string, unknown>;
    openApiSpec.paths = generatePaths(routes);

    return openApiSpec;
};

export const setupSwaggerUI = (app: Application): void => {
    const spec = generateOpenApiSpec();

    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));

    app.get("/api/openapi.json", (req, res) => {
        res.json(spec);
    });
};
