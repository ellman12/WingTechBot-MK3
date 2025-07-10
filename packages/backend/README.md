# WingTechBot MK3 - Backend

A robust Express.js backend service with Discord bot functionality, built with TypeScript and following hexagonal architecture principles.

## 🏗️ Architecture

This backend follows **Hexagonal Architecture** (also known as Ports and Adapters) to ensure clean separation of concerns and maintainability:

```
src/
├── adapters/           # External adapters (HTTP controllers, repositories)
│   ├── controllers/    # Express.js route handlers
│   └── repositories/   # Database implementations
├── application/        # Application services and use cases
├── core/              # Domain logic and business rules
│   ├── entities/      # Domain entities with validation
│   ├── errors/        # Domain-specific errors
│   ├── repositories/  # Repository interfaces
│   └── services/      # Domain services
├── infrastructure/    # Framework and external concerns
│   ├── config/        # Configuration management
│   ├── database/      # Database connection and setup
│   ├── discord/       # Discord bot implementation
│   └── http/          # Express.js server setup
└── generated/         # Auto-generated code (Prisma, Kysely)
```

## 🛠️ Technology Stack

- **Express.js 5** - Web framework
- **TypeScript 5** - Type safety and modern JavaScript features
- **Discord.js 14** - Discord bot functionality
- **Prisma** - Database ORM and migrations
- **Kysely** - Type-safe SQL query builder
- **PostgreSQL** - Production-ready database
- **Zod** - Runtime type validation
- **Vitest** - Testing framework
- **Docker** - Containerization

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm (install with `npm install -g pnpm`)
- Discord Application (for bot token)

### Environment Setup

1. **Clone and Install Dependencies**

   ```bash
   # From project root
   pnpm install
   ```

2. **Environment Variables**
   Create a `.env` file in the backend directory:

   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173

   # Database
   DATABASE_URL="postgresql://wingtechbot:wingtechbot_password@localhost:5432/wingtechbot"

   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_GUILD_ID=your_test_guild_id  # Optional: for guild-specific commands
   ```

3. **Database Setup**

   ```bash
   # Generate Prisma client and database types
   pnpm db:generate

   # Apply database schema
   pnpm db:push

   # Open Prisma Studio (optional)
   pnpm db:studio
   ```

### Development

```bash
# Start development server with hot reload
pnpm dev

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Format code
pnpm format
```

### Production Build

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## 🔌 API Documentation

The backend exposes a RESTful API under `/api/v1` with the following endpoints:

### Health Check

```http
GET /health
```

Returns server health status.

### Guild Management

#### Get All Guilds

```http
GET /api/v1/guilds
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "guild_id",
      "name": "Guild Name",
      "ownerId": "owner_user_id",
      "memberCount": 150,
      "prefix": "!",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get Guild by ID

```http
GET /api/v1/guilds/:id
```

**Parameters:**

- `id` (string): Guild ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "guild_id",
    "name": "Guild Name",
    "ownerId": "owner_user_id",
    "memberCount": 150,
    "prefix": "!",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Create Guild

```http
POST /api/v1/guilds
```

**Request Body:**

```json
{
  "id": "guild_id",
  "name": "New Guild",
  "ownerId": "owner_user_id",
  "memberCount": 1,
  "prefix": "!",
  "isActive": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "guild_id",
    "name": "New Guild",
    "ownerId": "owner_user_id",
    "memberCount": 1,
    "prefix": "!",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Update Guild

```http
PUT /api/v1/guilds/:id
```

**Parameters:**

- `id` (string): Guild ID

**Request Body (all fields optional):**

```json
{
  "name": "Updated Guild Name",
  "memberCount": 200,
  "prefix": "?",
  "isActive": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "guild_id",
    "name": "Updated Guild Name",
    "ownerId": "owner_user_id",
    "memberCount": 200,
    "prefix": "?",
    "isActive": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Delete Guild

```http
DELETE /api/v1/guilds/:id
```

**Parameters:**

- `id` (string): Guild ID

**Response:**

```json
{
  "success": true,
  "message": "Guild deleted successfully"
}
```

### Error Responses

All endpoints may return error responses with the following format:

```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "path": "field.name",
      "message": "Validation error message"
    }
  ]
}
```

**HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict (duplicate resources)
- `500` - Internal Server Error

## 🤖 Discord Bot

The backend includes a fully integrated Discord bot that:

- Connects to Discord using the provided bot token
- Handles Discord events and commands
- Integrates with the database for persistent data
- Shares the same domain logic as the REST API

### Bot Configuration

The bot is configured through environment variables and starts automatically with the server. It uses the same database connection and business logic as the REST API, ensuring consistency.

## 🗄️ Database

### Schema

The application uses the following main entities:

- **Guild**: Discord server information
- **User**: Discord user information
- **GuildMember**: User membership in guilds
- **Command**: Command execution history

### Migrations

```bash
# Create a new migration
pnpm db:migrate

# Reset database (development only)
pnpm db:push --force-reset

# View database in Prisma Studio
pnpm db:studio
```

## 🧪 Testing

The project uses Vitest for testing with the following structure:

```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
└── fixtures/          # Test data and helpers
```

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

## 🐳 Docker

### Build and Run

```bash
# Build Docker image
pnpm docker:build

# Run Docker container
pnpm docker:run

# Or use docker-compose
docker-compose up
```

### Docker Configuration

The Dockerfile is optimized for production with:

- Multi-stage build for smaller image size
- Non-root user for security
- Health checks
- Proper signal handling

## 📁 Code Organization

### Adding New Features

1. **Domain Entity** (`core/entities/`): Define the business entity with validation
2. **Repository Interface** (`core/repositories/`): Define data access contract
3. **Repository Implementation** (`adapters/repositories/`): Implement data access
4. **Service** (`core/services/`): Implement business logic
5. **Controller** (`adapters/controllers/`): Handle HTTP requests
6. **Routes** (`infrastructure/http/`): Register new endpoints

### Best Practices

- Use functional programming patterns where possible
- Implement proper error handling with custom error types
- Write comprehensive tests for business logic
- Use TypeScript strictly (no `any` or `unknown`)
- Follow the established naming conventions
- Ensure all async operations are properly handled

## 🔧 Configuration

Configuration is managed through the `ConfigService` singleton, which:

- Loads environment variables
- Validates required configuration
- Provides type-safe access to config values
- Fails fast on invalid configuration

## 📊 Monitoring and Logging

- **Health Checks**: `/health` endpoint for load balancer health checks
- **Structured Logging**: Uses console logging with proper error context
- **Request Logging**: Morgan middleware for HTTP request logging
- **Error Tracking**: Centralized error handling and logging

## 🛡️ Security

- **Helmet**: Security headers middleware
- **CORS**: Configurable cross-origin resource sharing
- **Input Validation**: Zod schemas for request validation
- **Error Sanitization**: Safe error responses without sensitive data

## 🚀 Deployment

### Environment Variables

Production deployment requires:

- `DATABASE_URL`: Production database connection
- `DISCORD_TOKEN`: Discord bot token
- `DISCORD_CLIENT_ID`: Discord application client ID
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Set to `production`
- `CORS_ORIGIN`: Frontend domain for CORS

### Database Migration

```bash
# Run migrations in production
npx prisma migrate deploy

# Generate client
npx prisma generate
```

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Discord.js Guide](https://discordjs.guide/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Kysely Documentation](https://kysely.dev/)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)

## 🤝 Contributing

1. Follow the established architecture patterns
2. Write tests for new functionality
3. Use conventional commit messages
4. Ensure TypeScript strict mode compliance
5. Update documentation for API changes
