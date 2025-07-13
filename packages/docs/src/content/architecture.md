# System Architecture

WingTechBot MK3 is a modern full-stack Discord bot application built with TypeScript, following hexagonal architecture (ports and adapters) principles. The system is organized as a monorepo with clear separation of concerns across multiple packages.

## High-Level Architecture

The system follows a modern, scalable architecture with clear separation of concerns:

- **Frontend (React)**: UI logic and user interactions
- **Backend (Express + Discord Bot)**: Business logic and Discord bot functionality
- **Database**: Data persistence and relationships
- **Types**: Shared type definitions

## Package Architecture

### Monorepo Structure

The project uses a **monorepo pattern** with clear package boundaries:

- **Backend Package**: Express.js API and Discord bot functionality
- **Frontend Package**: React web application with modern tooling
- **Types Package**: Shared TypeScript types and validation schemas
- **Documentation Package**: Developer documentation site

This structure enables:
- **Shared code** between packages
- **Independent development** of each package
- **Consistent tooling** across the entire project
- **Simplified dependency management**

## Backend Architecture (Hexagonal)

The backend follows **hexagonal architecture** with four distinct layers, each with clear responsibilities and dependencies.

### Layer Structure

The hexagonal architecture is organized into four concentric layers:

**Core Layer (Innermost)**
- Pure business logic
- Domain entities and business rules
- Domain services and use cases
- Repository interfaces (ports)
- Domain-specific errors

**Application Layer**
- Application contracts and orchestration
- API version management
- Route configurations
- Discord command handlers
- Application services

**Adapter Layer**
- HTTP controllers and presenters
- Repository implementations
- Service implementations
- Input/output adapters
- External system integrations

**Infrastructure Layer (Outermost)**
- HTTP routing and middleware
- Database connections
- Discord bot setup
- Configuration management
- External service connections

## Request Flow Patterns

### API Request Flow

The request flow follows a **unidirectional data flow** pattern:

1. **Infrastructure Layer:** Express app receives HTTP request
2. **Adapter Layer:** Controller validates and transforms request
3. **Application Layer:** Use case orchestrates business logic
4. **Core Layer:** Domain service executes business rules
5. **Adapter Layer:** Presenter transforms domain entities to API format
6. **Infrastructure Layer:** HTTP response is sent

## Frontend Architecture

### Component-Driven Architecture

The frontend follows **component-driven architecture** with:

- **Functional Components:** Modern React with hooks
- **State Management:** Zustand for global state
- **Type Safety:** TypeScript throughout the application
- **Modern Patterns:** React best practices and patterns

## Database Architecture

### Relational Design Principles

The database follows **relational design principles** with:

- **Normalized Schema:** Reduce data redundancy
- **Proper Indexing:** Optimize query performance
- **Foreign Key Relationships:** Ensure data integrity
- **Audit Trails:** Track changes with timestamps

## Key Architectural Benefits

### Clean Separation of Concerns
Business logic isolated in core layer, API contracts separate from implementation, infrastructure separate from application logic.

### Easy Version Management
Add new API versions by creating new contract/adapter directories, old versions remain isolated and maintainable.

### Testability
Core layer easily unit testable, adapters can be mocked or replaced, infrastructure can be swapped without affecting business logic.

### Maintainability
Clear boundaries between layers, easy to find and modify specific concerns, consistent patterns across the codebase.

## Summary

WingTechBot MK3 demonstrates a **well-architected, modern full-stack application** with hexagonal architecture ensuring clean separation of concerns, type safety throughout the entire stack, scalable monorepo structure, comprehensive testing strategy, modern tooling and best practices, Discord bot integration with clean abstractions, and production-ready deployment options. 