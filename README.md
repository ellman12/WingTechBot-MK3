# WingTechBot MK3 - Monorepo

![Online](https://img.shields.io/discord/111588824525627392?label=Servicing%20Users%3A&style=for-the-badge)
[![CI/CD Pipeline](https://github.com/ellman12/WingTechBot-MK3/workflows/CI%3ACD%20Pipeline/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/ci.yaml)
[![Release](https://github.com/ellman12/WingTechBot-MK3/workflows/Release/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/release.yaml)
[![Docker Build](https://github.com/ellman12/WingTechBot-MK3/workflows/Docker%20Build%20and%20Push/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/docker.yaml)
[![Dependency Updates](https://github.com/ellman12/WingTechBot-MK3/workflows/Update%20Dependencies/badge.svg)](https://github.com/ellman12/WingTechBot-MK3/actions/workflows/dependencies.yaml)

A full-stack Discord bot application built with TypeScript.

## 🏗️ Architecture

This project is organized as a monorepo with the following structure:

```
WingTechBot-MK3/
├── packages/
│   ├── backend/          # Express.js API & Discord Bot
│   └── frontend/         # React Web Application
├── package.json          # Root workspace configuration
└── README.md             # This file
```

## 🛠️ Technologies

### Backend (`packages/backend/`)

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Discord.js** - Discord bot functionality
- **Kysely** - Type-safe SQL query builder
- **Vitest** - Testing framework
- **Hexagonal Architecture** - Clean code organization

### Frontend (`packages/frontend/`)

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Zustand** - State management
- **TanStack Query** - Data fetching and caching

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm (install with `npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/ellman12/WingTechBot-MK3.git
cd WingTechBot-MK3

# Install dependencies for all packages
pnpm install

# Create a copy of .env.exampme, rename it to .env, and fill in the necessary values.
cp .env.example .env
```

### Development

#### Start both backend and frontend:

```bash
pnpm dev:all
```

#### Start individual services:

```bash
# Backend only (Discord bot + API)
pnpm dev

# Frontend only (React app)
pnpm dev:frontend
```

#### Database Operations:

```bash
# Run database migrations
pnpm db:migrate

pnpm db:generate
```

#### Building for Production:

```bash
# Build all packages
pnpm build

# Build specific packages
pnpm build:backend
pnpm build:frontend
pnpm build:types
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
pnpm test:frontend
```

## 📁 Package Details

### Backend Package

The backend serves as both a Discord bot and a REST API. It follows hexagonal architecture principles with clear separation of concerns.

**Structure:**

```
packages/backend/src/
├── adapters/           # External adapters (Discord, DB, etc.)
├── application/        # Use cases and application logic
├── core/               # Domain models and business logic
├── infrastructure/     # Framework and external concerns
```

### Frontend Package

A modern React application with state-of-the-art tooling for building user interfaces.

**Structure:**

```
packages/frontend/src/
├── components/       # Reusable UI components
├── hooks/            # Custom React hooks
├── stores/           # Zustand state stores
└── App.tsx           # Main application component
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
