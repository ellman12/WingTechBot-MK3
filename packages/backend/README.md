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
   Create a `.env` file in the backend directory following the `.env.example`.

3. **Database Setup**

    ```bash
    pnpm db:migrate

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

## 📁 Code Organization

### Best Practices

- Use functional programming patterns where possible
- Implement proper error handling with custom error types
- Write comprehensive tests for business logic
- Use TypeScript strictly (no `any` or `unknown`)
- Follow the established naming conventions
- Ensure all async operations are properly handled

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
