# API Documentation

This directory contains auto-generated OpenAPI documentation for the WingTechBot MK3 API.

## 📋 Files

- `openapi.json` - Auto-generated OpenAPI 3.0.3 specification
- `README.md` - This documentation file

## 🔧 Generation

The OpenAPI documentation is automatically generated from your route definitions and Zod schemas. The generation process:

1. **Scans your route registry** for all registered API endpoints
2. **Extracts Zod schemas** from your route definitions (request/response/query/params)
3. **Generates OpenAPI paths** with proper parameter definitions
4. **Creates schema definitions** from your Zod schemas
5. **Outputs a complete OpenAPI 3.0.3 spec** in JSON format

## 🚀 Commands

### Generate Documentation

```bash
# Generate fresh OpenAPI documentation
pnpm run docs:generate
```

### Sync Documentation (Smart Update)

```bash
# Only update if changes are detected
pnpm run docs:sync
```

### Build with Documentation

```bash
# Build TypeScript and generate docs
pnpm run build:with-docs
```

## 📖 Viewing Documentation

Once your server is running, you can view the documentation at:

- **Swagger UI**: `http://localhost:4040/api/docs`
- **OpenAPI JSON**: `http://localhost:4040/api/docs/openapi.json`
- **API Versions**: `http://localhost:4040/api/versions`

## 🔄 Auto-Generation Features

### What's Auto-Generated

- ✅ **API Paths** - All registered routes with HTTP methods
- ✅ **Request/Response Schemas** - From your Zod schemas
- ✅ **Query Parameters** - Automatically extracted from query schemas
- ✅ **Path Parameters** - From route path patterns like `{id}`
- ✅ **Error Responses** - Standard API error format
- ✅ **Operation IDs** - Unique identifiers for each endpoint
- ✅ **Tags** - Organized by route groups
- ✅ **Descriptions** - From your route definitions

### Example Route Definition

```typescript
// This route definition automatically generates OpenAPI docs
{
    method: "get",
    path: "/users/{id}",
    summary: "Get user by ID",
    description: "Retrieve a specific user by their ID",
    tags: ["Users"],
    handler: getUserHandler,
    paramsSchema: z.object({ id: z.string() }),
    responseSchema: UserResponseSchema,
}
```

### Generated OpenAPI Output

```json
{
    "paths": {
        "/api/v1/users/{id}": {
            "get": {
                "summary": "Get user by ID",
                "description": "Retrieve a specific user by their ID",
                "tags": ["Users"],
                "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                "responses": { "200": { "description": "Success", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/GetApiV1UsersIdResponse" } } } } }
            }
        }
    }
}
```

## 🎯 Best Practices

### 1. Always Use Zod Schemas

```typescript
// ✅ Good - Provides automatic validation and documentation
const UserResponseSchema = z.object({ id: z.string(), name: z.string(), email: z.string().email() }).openapi({ title: "UserResponse", description: "User information response" });
```

### 2. Provide Clear Descriptions

```typescript
// ✅ Good - Clear documentation
{
    summary: "Create a new user",
    description: "Creates a new user account with the provided information",
    tags: ["Users"],
}
```

### 3. Use Meaningful Tags

```typescript
// ✅ Good - Organized by feature
tags: ["Users", "Authentication"];
```

### 4. Keep Schemas Reusable

```typescript
// ✅ Good - Reusable across multiple endpoints
const UserBaseSchema = z.object({ name: z.string(), email: z.string().email() });

const CreateUserRequestSchema = UserBaseSchema;
const UpdateUserRequestSchema = UserBaseSchema.partial();
```

## 🔧 Troubleshooting

### No Routes Generated

- Ensure routes are registered with `registerVersion()` in your route setup
- Check that `initializeV1Routes()` is called before generating docs

### Missing Schemas

- Verify Zod schemas are properly defined with `.openapi()` extensions
- Check that schemas are referenced in route definitions

### Type Errors

- Make sure all Zod schemas are properly typed
- Use `z.ZodTypeAny` for complex schemas if needed

## 📝 Manual Overrides

If you need to customize the generated OpenAPI spec, you can:

1. **Modify the generator** in `src/infrastructure/http/OpenApiGenerator.ts`
2. **Add custom schemas** to the registry
3. **Override specific paths** in the generation logic

However, it's recommended to keep the generation automatic and modify your route definitions instead.
