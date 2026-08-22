# WingTechBot MK3 - Monorepo

[![CI/CD Pipeline](https://github.com/ellman12/WingTechBot-MK3/workflows/CI%3ACD%20Pipeline/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/ci.yaml)
[![Release](https://github.com/ellman12/WingTechBot-MK3/workflows/Release/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/release.yaml)
[![Docker Build](https://github.com/ellman12/WingTechBot-MK3/workflows/Docker%20Build%20and%20Push/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/docker.yaml)
[![Dependency Updates](https://github.com/ellman12/WingTechBot-MK3/workflows/Update%20Dependencies/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/dependencies.yaml)

A Discord bot built with TypeScript: soundboard, karma/reaction tracking, and an LLM-powered chat companion for a single guild.

## 🏗️ Architecture

This project is organized as a monorepo with the following structure:

```
WingTechBot-MK3/
├── packages/
│   ├── backend/          # Discord bot (functional hexagonal architecture — see packages/backend/ARCHITECTURE.md)
│   └── backup/           # Postgres backup sidecar
├── package.json          # Root workspace configuration
└── README.md            # This file
```

## 🛠️ Technologies

### Backend (`packages/backend/`)

- **TypeScript** - Type safety
- **Discord.js** - Discord bot functionality
- **Kysely** - Type-safe SQL query builder
- **Vitest** - Testing framework

## 🚀 Getting Started

### Prerequisites

- Node.js v24 or greater
- pnpm v11 or greater (install with `npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/ellman12/WingTechBot-MK3.git
cd WingTechBot-MK3

# Install dependencies for all packages
pnpm install
```

### Development

#### Start both backend and frontend:

#### Database Operations:

```bash
pnpm db:generate

# Run database migrations
pnpm db:migrate
```

#### Building for Production:

```bash
# Build all packages
pnpm build

# Build specific packages
pnpm build:backend
```

#### Code Quality:

```bash
# Run linting on all packages
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check
```

#### Testing:

```bash
# Run tests for all packages
pnpm test

# Run tests for specific packages
pnpm test:backend
```

## 📁 Package Details

### Backend Package

The backend is the Discord bot. It follows a functional hexagonal architecture: a Discord-free `core`
(entities, ports, services) driven by `application/discord` (commands, event handlers, startup
orchestration), with `adapters` implementing the core ports (Kysely, ffmpeg, yt-dlp, Gemini, Discord
voice) and `infrastructure` hosting the Discord client and DB connection. Layer boundaries are enforced
by ESLint — see [packages/backend/ARCHITECTURE.md](packages/backend/ARCHITECTURE.md).

**Structure:**

```
packages/backend/src/
├── core/              # Domain: entities, ports, services, utils (no discord.js / kysely)
├── application/       # Driving side: commands/, discord/
├── adapters/          # Driven side: Kysely repos, ffmpeg, yt-dlp, Gemini, Discord voice, filesystem
├── infrastructure/    # Discord client lifecycle, DB connection, process wrappers
└── main.ts            # Composition root
```

## 🐳 Docker Support

The backend includes Docker support for easy deployment:

```bash
# Build Docker image (from backend directory)
cd packages/backend
pnpm docker:build

# Run Docker container
pnpm docker:run
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
