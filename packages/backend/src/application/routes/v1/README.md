# API v1 Route Organization

This directory contains the route configurations for API v1, organized by feature/domain to maintain clean separation and scalability.

## 📁 **File Structure**

```
v1/
├── routes.ts          # Main route configuration (orchestrates all route groups)
├── health.ts          # Health check routes (/health)
└── README.md          # This documentation
```

## 🎯 **Organization Principles**

### **1. Feature-Based Separation**

Each file contains routes for a specific domain/feature:

- **`health.ts`** - API health and status endpoints
- **Feature**: `users.ts`, etc.

### **2. Single Responsibility**

Each route file is responsible for:

- Defining routes for one domain
- Importing relevant controllers and schemas
- Exporting a `RouteGroup` configuration

### **3. Scalable Structure**

Adding new features is straightforward:

1. Create new route file (e.g., `users.ts`)
2. Define route group with handlers and schemas
3. Import and add to main `routes.ts` configuration

## 📋 **Route File Template**

```typescript
import type { Kysely } from "kysely";

import "../../../adapters/http/v1/controllers/FeatureController.js";
import type { DB } from "../../../generated/database/types.js";
import type { RouteGroup } from "../../../infrastructure/http/api/types.js";
import "../../contracts/v1/requests.js";
import "../../contracts/v1/responses.js";

// Feature routes configuration for API v1
export const createFeatureRoutes = (db: Kysely<DB>): RouteGroup => ({
    name: "feature",
    basePath: "/feature",
    tags: ["Feature"],
    routes: [
        // Route definitions...
    ],
});
```

## 🔄 **Adding New Route Groups**

### **1. Create Route File**

```bash
# Example: Adding user management
touch src/application/routes/v1/users.ts
```

### **2. Define Routes**

```typescript
// users.ts
export const createUserRoutes = (db: Kysely<DB>): RouteGroup => ({
    name: "users",
    basePath: "/users",
    tags: ["Users"],
    routes: [
        // User CRUD operations...
    ],
});
```

### **3. Register in Main Configuration**

```typescript
// routes.ts
import { createUserRoutes } from "./users.js";

export const createV1ApiConfiguration = (db: Kysely<DB>): ApiVersionConfiguration => ({
    config: { version: "v1", basePath: "/api/v1" },
    groups: [
        createHealthRoutes(),
        createUserRoutes(db), // Add new route group
    ],
});
```

## 📊 **Current Route Groups**

| File        | Base Path | Description       | Endpoints         |
| ----------- | --------- | ----------------- | ----------------- |
| `health.ts` | `/health` | API health checks | 1 (health status) |

## 🎯 **Benefits**

### **1. Maintainability**

- **Clear organization** by domain/feature
- **Easy to find** specific route definitions
- **Reduced file size** - each file has focused responsibility

### **2. Scalability**

- **Add new features** without cluttering existing files
- **Team collaboration** - different developers can work on different route files
- **Clear boundaries** between different domains

### **3. Documentation**

- **Self-documenting** structure
- **Easy to understand** what each file contains
- **Clear import paths** for related functionality

## 🚀 **Future Extensions**

As the API grows, you can easily add:

```typescript
// Future route files:
users.ts; // User management
permissions.ts; // Permission management
analytics.ts; // Usage analytics
webhooks.ts; // Webhook endpoints
```

This structure ensures the codebase remains organized and maintainable as it scales! 🎉
