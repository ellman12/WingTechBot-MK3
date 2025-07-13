# Development Guide

This guide provides comprehensive information for developing with WingTechBot MK3, covering setup, workflows, best practices, and practical development tips.

## Getting Started

### Prerequisites

**Required Software:**

- Node.js (version 18.0.0 or higher)
- pnpm (install with npm install -g pnpm)
- Git for version control
- Docker
- Discord Application for bot token

### Initial Setup

1. **Clone the Repository:** `git clone git@github.com:ellman12/WingTechBot-MK3.git && cd WingTechBot-MK3`
2. **Install Dependencies:** `pnpm install`
3. **Environment Configuration:** Copy example env file and configure settings
4. **Database Setup:** `pnpm db:generate && pnpm db:push`
5. **Start Development:** `pnpm dev:all`

## Development Best Practices

### TypeScript Best Practices

- **Type Safety:** Use strict TypeScript, avoid any/unknown
- **Error Handling:** Use custom error types
- **Interfaces:** We're using types and factory functions instead of interfaces and classes

## Adding API Routes

API routes are organized by version and feature. To add a new route:

1. **Create or update a route group** in `src/application/routes/v1/` (e.g., `users.ts`).

2. **Define your route(s)** using the `RouteGroup` structure. Example:

```typescript
export const createUserRoutes = (db: Kysely<DB>): RouteGroup => ({
    name: "users",
    basePath: "/users",
    tags: ["Users"],
    routes: [
        {
            method: "get",
            path: "/",
            summary: "Get all users",
            handler: getUsersHandler(db),
            // ...schemas
        },
        // More routes...
    ],
});
```

3. **Register your group** in `routes.ts`:

```typescript
import { createUserRoutes } from "./users";

export const createV1ApiConfiguration = (db: Kysely<DB>) => ({
    config: { version: "v1", basePath: "/api/v1" },
    groups: [
        createHealthRoutes(),
        createUserRoutes(db), // Add here
    ],
});
```

**Tip:** Use `{id}` in paths for parameters (auto-converted to Express style). Add `summary`, `description`, and `tags` for documentation.

## Adding Discord Slash Commands

Slash commands are defined in the `src/application/commands/` directory. To add a new command:

1. **Edit or create a command** in `voice-commands.ts` (or a new file). Example:

```typescript
const pingCommand: Command = {
    data: new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!"),
    execute: async interaction => {
        await interaction.reply("Pong!");
    },
};
```

2. **Add your command** to the exported command map/object.

3. **Deploy commands** to Discord:

```bash
pnpm discord:deploy-commands
```

_(Guild commands update instantly; global commands may take up to 1 hour.)_

**Tip:** Use `SlashCommandBuilder` for type-safe command definitions.
