# Hexagonal Architecture Structure

This backend follows **hexagonal architecture** (also known as ports and adapters architecture) with proper separation of concerns across layers. The API versioning system has been reorganized to respect these architectural boundaries.

## 🏗️ **Architecture Overview**

```
src/
├── main.ts                        # Application entry point
├── core/                          # Domain Layer (Business Logic)
│   ├── entities/                  # Domain entities and business rules
│   ├── services/                  # Domain services
│   └── errors/                    # Domain-specific errors
│
├── application/                   # Application Layer (Use Cases & Contracts)
│   ├── contracts/                 # API contracts (input/output definitions)
│   │   └── v1/                   # Version 1 API contracts
│   │       ├── types.ts          # Core API types
│   │       ├── requests.ts       # Request validation schemas
│   │       └── responses.ts      # Response validation schemas
│   └── routes/                    # Route configurations (application logic)
│       └── v1/
│           └── routes.ts         # V1 route definitions
│
├── adapters/                      # Adapter Layer (Input/Output Adapters)
│   └── http/                     # HTTP adapters
│       └── v1/                   # Version 1 HTTP adapters
│           ├── controllers/      # HTTP input adapters
│           └── presenters/       # Domain → API transformations
│
└── infrastructure/               # Infrastructure Layer (Technical Mechanisms)
    ├── http/                     # HTTP infrastructure
    │   ├── api/                  # API infrastructure
    │   │   ├── types.ts          # Core versioning types
    │   │   ├── VersionedApiRouter.ts      # Main router
    │   │   ├── VersionedRouteRegistry.ts  # Route registry
    │   │   └── README.md         # API versioning documentation
    │   ├── VersionedOpenApiGenerator.ts   # Documentation generator
    │   └── ExpressApp.ts         # Express app setup (clean!)
    ├── database/                 # Database infrastructure
    ├── config/                   # Configuration management
    └── discord/                  # Discord bot infrastructure
```

## 📋 **Layer Responsibilities**

### **1. Core Layer** (`src/core/`)

- **Pure business logic** - no external dependencies
- Domain entities with business rules
- Domain services and use cases
- Domain-specific errors and validations

### **2. Application Layer** (`src/application/`)

- **Application contracts and orchestration**
- **API Contracts** (`contracts/v1/`): Define input/output shapes for each API version
- **Route Configurations** (`routes/v1/`): Define application-level routing logic
- Version-specific type definitions and validation schemas
- **No HTTP or infrastructure concerns**

### **3. Adapter Layer** (`src/adapters/`)

- **Input/Output adapters** that connect external world to application
- **Controllers** (`http/v1/controllers/`): HTTP input adapters that handle requests
- **Presenters** (`http/v1/presenters/`): Transform domain entities to API representations
- **Clean separation** between different adapter types (HTTP, CLI, etc.)

### **4. Infrastructure Layer** (`src/infrastructure/`)

- **Technical mechanisms and frameworks**
- HTTP routing infrastructure (`VersionedApiRouter`, `VersionedRouteRegistry`)
- OpenAPI documentation generation
- Database connections, configuration, external services
- **No business logic or domain concerns**

## 🔄 **Request Flow Example**

```
HTTP Request
    ↓
[Infrastructure] ExpressApp → VersionedApiRouter
    ↓
[Adapters] HTTP Controller (validates request, calls domain)
    ↓
[Core] Domain Service (business logic)
    ↓
[Core] Domain Entity (business rules)
    ↓
[Adapters] Presenter (transforms domain → API format)
    ↓
[Infrastructure] HTTP Response
```

## 🎯 **Key Benefits of This Structure**

### **1. Clean Separation of Concerns**

- **Business logic** isolated in core layer
- **API contracts** separate from implementation
- **Infrastructure** separate from application logic

### **2. Easy Version Management**

- Add new API versions by creating new contract/adapter directories
- Old versions remain isolated and maintainable
- Clear deprecation and migration paths

### **3. Testability**

- Core layer easily unit testable (no external dependencies)
- Adapters can be mocked or replaced
- Infrastructure can be swapped without affecting business logic

### **4. Maintainability**

- Clear boundaries between layers
- ExpressApp.ts is now clean and focused
- Easy to find and modify specific concerns

## 📦 **Adding a New API Version (v2)**

### **1. Create Application Contracts**

```bash
mkdir -p src/application/contracts/v2
# Create types.ts, requests.ts, responses.ts
```

### **2. Create HTTP Adapters**

```bash
mkdir -p src/adapters/http/v2/{controllers,presenters}
# Create controllers and presenters for v2
```

### **3. Create Route Configuration**

```bash
mkdir -p src/application/routes/v2
# Create routes.ts with v2 route definitions
```

### **4. Register in Infrastructure**

```typescript
// In VersionedApiRouter.ts
import { createV2ApiConfiguration } from "../../../application/routes/v2/routes.js";

// Register v2 configuration
const v2Config = createV2ApiConfiguration();
VersionedRouteRegistry.registerVersion(v2Config);
```

## 🚫 **What NOT to Put Where**

### **❌ Application Layer Should NOT Contain:**

- HTTP request/response objects
- Express middleware
- Database connection details
- Infrastructure concerns

### **❌ Adapter Layer Should NOT Contain:**

- Business logic or domain rules
- Infrastructure setup (database connections, etc.)
- Cross-cutting concerns like logging frameworks

### **❌ Infrastructure Layer Should NOT Contain:**

- Business logic
- API-specific validation rules
- Domain transformations

### **❌ Project-Wide Guidelines:**

- **No index.ts files** - All imports must be direct to specific files for better maintainability and traceability
- Entry point is `main.ts` instead of `index.ts`

## 🔍 **Migration Benefits**

**Before**: Everything in `infrastructure/http/api/v1/` ❌

```
infrastructure/http/api/v1/
├── schemas.ts      # Mixed concerns
├── controllers.ts  # Wrong layer
└── routes.ts       # Wrong layer
```

**After**: Proper hexagonal separation ✅

```
application/contracts/v1/    # API contracts
adapters/http/v1/           # HTTP adapters
application/routes/v1/      # Route configuration
infrastructure/http/api/    # Only technical mechanisms
```

This structure ensures that:

- **Business logic** stays in the core
- **API contracts** are clearly defined
- **Adapters** handle I/O transformations
- **Infrastructure** provides technical mechanisms
- **Easy to test, maintain, and extend**

The architecture now properly reflects hexagonal principles while supporting robust API versioning! 🎉
