# Adding New API Routes

With the automated OpenAPI setup, adding new routes is **incredibly simple**. You only need to add one function call and the documentation is generated automatically!

## ✅ **How to Add a New Route**

### 1. **For API Routes** (under `/api/v1`)

Instead of the old way:

```typescript
// ❌ Old manual way
apiRouter.get("/users", getUsersHandler(db));
```

Use the new automated way:

```typescript
// ✅ New automated way
registerApiRoute(apiRouter, {
    method: "get",
    path: "/users",
    summary: "Get all users",
    description: "Retrieve a list of all Discord users",
    tags: ["Users"],
    handler: getUsersHandler(db),
    // Optional: Add schemas for automatic validation docs
    responseSchema: GetUsersResponseSchema,
    querySchema: GetUsersQuerySchema,
});
```

### 2. **For Non-API Routes** (like health checks)

```typescript
registerHealthRoute(app, "/status", (req, res) => {
    res.json({ status: "healthy", uptime: process.uptime() });
});
```

## 🎯 **Complete Example: Adding User Endpoints**

Here's how you'd add a complete set of user management endpoints:

```typescript
// In your route setup file (ExpressApp.ts)

// Get all users
registerApiRoute(apiRouter, { method: "get", path: "/users", summary: "Get all users", description: "Retrieve a list of all Discord users", tags: ["Users"], handler: getUsersHandler(db) });

// Get user by ID
registerApiRoute(apiRouter, { method: "get", path: "/users/{id}", summary: "Get user by ID", description: "Retrieve a specific Discord user by their ID", tags: ["Users"], handler: getUserByIdHandler(db) });

// Create new user
registerApiRoute(apiRouter, { method: "post", path: "/users", summary: "Create a new user", description: "Create a new Discord user entry", tags: ["Users"], handler: createUserHandler(db) });

// Update user
registerApiRoute(apiRouter, { method: "put", path: "/users/{id}", summary: "Update a user", description: "Update an existing Discord user", tags: ["Users"], handler: updateUserHandler(db) });

// Delete user
registerApiRoute(apiRouter, { method: "delete", path: "/users/{id}", summary: "Delete a user", description: "Remove a Discord user entry", tags: ["Users"], handler: deleteUserHandler(db) });
```

## 🔧 **Path Parameters**

The system automatically handles path parameters:

- Use `{id}` in the path (OpenAPI format)
- It automatically converts to `:id` for Express
- Documentation is generated automatically

```typescript
registerApiRoute(apiRouter, {
    method: "get",
    path: "/guilds/{guildId}/members/{userId}", // OpenAPI format
    summary: "Get guild member",
    tags: ["Guild Members"],
    handler: getGuildMemberHandler(db),
});
// Automatically becomes: router.get('/guilds/:guildId/members/:userId', handler)
```

## 📝 **Advanced: Adding Schema Validation**

For complete type safety and documentation:

```typescript
import { CreateUserRequestSchema, GetUsersResponseSchema } from "@wingtechbot-mk3/types";

registerApiRoute(apiRouter, {
    method: "post",
    path: "/users",
    summary: "Create a new user",
    tags: ["Users"],
    handler: createUserHandler(db),
    requestSchema: CreateUserRequestSchema, // Validates request body
    responseSchema: GetUsersResponseSchema, // Documents response format
    paramsSchema: CreateUserParamsSchema, // Validates path parameters
    querySchema: CreateUserQuerySchema, // Validates query parameters
});
```

## 🚀 **What Happens Automatically**

When you add a route using `registerApiRoute`, you get:

1. ✅ **Express route registration** - Your API works immediately
2. ✅ **OpenAPI documentation** - Appears in Swagger UI instantly
3. ✅ **Schema conversion** - Zod schemas become OpenAPI schemas
4. ✅ **Error responses** - Common 400/404/500 responses added automatically
5. ✅ **Path conversion** - `{id}` ↔ `:id` handled automatically
6. ✅ **Tags organization** - Routes grouped by tags in documentation

## 📖 **Viewing Documentation**

After adding routes:

1. **Live docs**: Start server with `pnpm dev` → visit `http://localhost:3000/api/docs`
2. **Static file**: Run `pnpm run docs:generate` → check `docs/openapi.json`

## 🎯 **Best Practices**

### Tags

Group related endpoints with consistent tags:

```typescript
tags: ["Users"]; // All user operations
tags: ["Guilds"]; // All guild operations
tags: ["Commands"]; // All command operations
```

### Descriptions

Be descriptive but concise:

```typescript
summary: 'Get user by ID',
description: 'Retrieve a specific Discord user by their ID. Returns 404 if user not found.'
```

### Schema Organization

Keep schemas in your types package:

```typescript
// In packages/types/src/api/user.ts
export const CreateUserRequestSchema = z.object({...});
export const GetUserResponseSchema = z.object({...});

// Then import and use
import { CreateUserRequestSchema } from '@wingtechbot-mk3/types';
```

## 🔄 **Migration from Old Routes**

To migrate existing routes:

1. **Before**:

```typescript
apiRouter.get("/guilds", getGuildsHandler(db));
apiRouter.post("/guilds", createGuildHandler(db));
```

2. **After**:

```typescript
registerApiRoute(apiRouter, { method: "get", path: "/guilds", summary: "Get all guilds", tags: ["Guilds"], handler: getGuildsHandler(db) });

registerApiRoute(apiRouter, { method: "post", path: "/guilds", summary: "Create a new guild", tags: ["Guilds"], handler: createGuildHandler(db) });
```

That's it! Your documentation is now automatically generated and always stays in sync with your code. 🎉
