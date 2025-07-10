# WingTechBot MK3 Documentation

Welcome to the comprehensive documentation for WingTechBot MK3! This directory contains detailed guides covering all aspects of the project.

## 📚 Documentation Index

### Getting Started

- **[Development Guide](DEVELOPMENT.md)** - Complete development workflow and environment setup
- **[Contributing](CONTRIBUTING.md)** - How to contribute to the project
- **[Architecture Overview](ARCHITECTURE.md)** - System design and architectural patterns

### Development Guides

- **[API Documentation](API.md)** - REST API endpoints and usage
- **[Discord Bot Guide](DISCORD_BOT.md)** - Discord bot setup and features
- **[Database Guide](DATABASE.md)** - Schema, migrations, and database operations
- **[Frontend Guide](FRONTEND.md)** - React application development

### Operations

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment strategies

## 🚀 Quick Start

### For New Developers

1. Start with [Development Guide](DEVELOPMENT.md) for environment setup
2. Read [Architecture Overview](ARCHITECTURE.md) to understand the system
3. Follow [Contributing Guidelines](CONTRIBUTING.md) for workflow

### For API Users

1. Check [API Documentation](API.md) for endpoint details
2. Review authentication requirements
3. Test with the interactive docs at `/api/docs`

### For Frontend Developers

1. Read [Frontend Guide](FRONTEND.md) for React development

2. Follow component and styling guidelines

### For Discord Bot Development

1. Start with [Discord Bot Guide](DISCORD_BOT.md) for setup
2. Learn about event handling and command creation
3. Review security best practices

### For Database Work

1. Review [Database Guide](DATABASE.md) for schema details
2. Learn migration strategies and best practices
3. Understand query optimization techniques

### For Deployment

1. Follow [Deployment Guide](DEPLOYMENT.md) for production setup
2. Configure monitoring and logging
3. Set up CI/CD pipelines

## 🏗️ Project Structure Overview

```
WingTechBot-MK3/
├── docs/                     # 📚 Documentation (this directory)
│   ├── README.md            # This file - documentation index
│   ├── CONTRIBUTING.md      # Contribution guidelines
│   ├── DEVELOPMENT.md       # Development workflow
│   ├── ARCHITECTURE.md      # System architecture
│   ├── API.md               # API documentation
│   ├── DISCORD_BOT.md       # Discord bot guide
│   ├── DATABASE.md          # Database guide
│   ├── FRONTEND.md          # Frontend development
│   └── DEPLOYMENT.md        # Deployment guide
├── packages/
│   ├── backend/             # 🖥️ Express API + Discord Bot
│   ├── frontend/            # 🎨 React Application
│   └── types/               # 📝 Shared TypeScript Types
├── package.json             # Workspace configuration
└── README.md               # Project overview
```

## 🛠️ Technology Stack

### Backend

- **Express.js** - Web framework
- **Discord.js** - Discord bot functionality
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **Kysely** - Type-safe SQL queries
- **PostgreSQL** - Database
- **Docker** - Containerization

### Frontend

- **React 19** - UI library
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **TanStack Query** - Data fetching

### Architecture

- **Hexagonal Architecture** - Clean separation of concerns
- **Monorepo** - pnpm workspaces
- **Type Safety** - End-to-end TypeScript
- **Testing** - Vitest, Jest, Testing Library

## 🔗 Quick Links

### Development

- **Local API**: http://localhost:3000
- **Frontend Dev**: http://localhost:5173

- **API Docs**: http://localhost:3000/api/docs

### Documentation Sources

- [Prisma Docs](https://www.prisma.io/docs)
- [Discord.js Guide](https://discordjs.guide/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Tools & Resources

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Prisma Studio](http://localhost:5555) (when running)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 📖 Documentation Conventions

### Code Examples

- ✅ **Good examples** are marked with green checkmarks
- ❌ **Bad examples** are marked with red X marks
- Code blocks include language syntax highlighting
- Real-world examples with context

### File Structure

- Each guide is self-contained but cross-references others
- Code examples are functional and tested
- Screenshots and diagrams where helpful
- Step-by-step instructions for complex procedures

### Maintenance

- Documentation is updated with every feature change
- Examples are tested against the current codebase
- Links are verified regularly
- Community feedback is incorporated

## 🎯 Document Purposes

| Document                           | Primary Audience    | Key Information                |
| ---------------------------------- | ------------------- | ------------------------------ |
| [DEVELOPMENT.md](DEVELOPMENT.md)   | New developers      | Setup, workflow, tools         |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributors        | Guidelines, standards, process |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical leads     | Design patterns, decisions     |
| [API.md](API.md)                   | API consumers       | Endpoints, authentication      |
| [DISCORD_BOT.md](DISCORD_BOT.md)   | Bot developers      | Commands, events, setup        |
| [DATABASE.md](DATABASE.md)         | Backend developers  | Schema, queries, migrations    |
| [FRONTEND.md](FRONTEND.md)         | Frontend developers | Components, state, styling     |
| [DEPLOYMENT.md](DEPLOYMENT.md)     | DevOps, maintainers | Production deployment          |

## 🤝 Contributing to Documentation

Found an error or want to improve the docs?

1. **Small fixes**: Edit directly and submit a PR
2. **New content**: Create an issue to discuss first
3. **Examples**: Ensure they work with current code
4. **Style**: Follow existing formatting conventions

### Documentation Standards

- Use clear, concise language
- Include working code examples
- Add visual aids where helpful
- Cross-reference related sections
- Keep content up-to-date with code changes

## 💡 Getting Help

- **General questions**: Check existing documentation first
- **Technical issues**: Create a GitHub issue
- **Feature requests**: Use GitHub Discussions
- **Security concerns**: Email maintainers directly

## 🔄 Documentation Updates

This documentation is actively maintained and updated with each release. Major sections are reviewed quarterly for accuracy and completeness.

Last updated: December 2024
Documentation version: 3.0

---

**Happy coding! 🚀**

For additional support, see the main [README.md](../README.md) or visit our GitHub repository.
