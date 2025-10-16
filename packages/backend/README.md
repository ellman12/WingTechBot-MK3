# WingTechBot MK3 - Backend

A robust Express.js backend service with Discord bot functionality, built with TypeScript and following hexagonal architecture principles. Designed for single-server Discord bots.

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
└── generated/         # Auto-generated code (Kysely)
```

## 🛠️ Technology Stack

- **Express.js 5** - Web framework
- **TypeScript 5** - Type safety and modern JavaScript features
- **Discord.js 14** - Discord bot functionality
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
- Ffmpeg
- yt-dlp
- libopus-dev
- build-tools

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
    DISCORD_GUILD_ID=your_guild_id  # The single server your bot will operate in
    ```

3. **Database Setup**

    ```bash
    pnpm db:generate
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

The backend exposes a RESTful API under `/api/v1` with automatically generated OpenAPI documentation.

### 📖 Viewing Documentation

Once the server is running, you can view the API documentation at:

- **Swagger UI**: `http://localhost:4040/api/docs`
- **OpenAPI JSON**: `http://localhost:4040/api/docs/openapi.json`
- **API Versions**: `http://localhost:4040/api/versions`

### 🔧 Generating Documentation

The OpenAPI documentation is automatically generated from your route definitions and Zod schemas:

```bash
# Generate fresh documentation
pnpm run docs:generate

# Sync documentation (only update if changes detected)
pnpm run docs:sync

# Build with documentation
pnpm run build:with-docs
```

For detailed information about the documentation system, see [`docs/README.md`](docs/README.md).

### Current Endpoints

### Health Check

```http
GET /health
```

Returns server health status.

**Response:**

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

### Error Responses

All endpoints may return error responses with the following format:

```json
{ "success": false, "error": "Error message", "details": [{ "path": "field.name", "message": "Validation error message" }] }
```

**HTTP Status Codes:**

- `200` - Success
- `400` - Bad Request (validation errors)
- `500` - Internal Server Error

## 🤖 Discord Bot

The backend includes a fully integrated Discord bot that:

- Connects to Discord using the provided bot token
- Handles Discord events and commands
- Integrates with the database for persistent data
- Designed for single-server operation

### Bot Configuration

The bot is configured through environment variables and starts automatically with the server. It uses the same database connection and business logic as the REST API, ensuring consistency.

### Discord Commands

The bot includes several voice-related slash commands:

- `/join [channel]` - Join a voice channel
- `/leave` - Leave the current voice channel
- `/play <source>` - Play audio from a URL or file
- `/stop` - Stop current audio playback
- `/volume [level]` - Set or get the volume level

#### Deploying Commands

Commands need to be deployed to Discord's API to appear in the Discord UI:

```bash
# Deploy commands to Discord
pnpm discord:deploy-commands

# Or from the root directory
pnpm discord:deploy-commands
```

**Development Mode**: Commands are automatically deployed when the bot starts in development mode.

**Production**: Deploy commands manually before starting the bot in production.

**Guild vs Global Commands**:

- If `DISCORD_GUILD_ID` is set, commands deploy to that specific guild (instant)
- If not set, commands deploy globally (takes up to 1 hour to propagate)

## 🗄️ Database

### Schema

The application uses the following main entities:

- **User**: Discord user information

### Migrations

```bash
# Create a new migration
pnpm db:migrate

# Reset database (development only)
pnpm db:push --force-reset
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
- `DISCORD_GUILD_ID`: The single Discord server ID
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Set to `production`
- `CORS_ORIGIN`: Frontend domain for CORS

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Discord.js Guide](https://discordjs.guide/)
- [Kysely Documentation](https://kysely.dev/)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)

## 🤝 Contributing

1. Follow the established architecture patterns
2. Write tests for new functionality
3. Use conventional commit messages
4. Ensure TypeScript strict mode compliance
5. Update documentation for API changes
