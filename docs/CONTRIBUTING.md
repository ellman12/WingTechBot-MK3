# Contributing to WingTechBot MK3

Welcome to WingTechBot MK3! We're excited that you want to contribute. This guide will help you get started with contributing to our Discord bot project.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm (install with `npm install -g pnpm`)
- Git
- A Discord application/bot token for testing

### Development Setup

1. **Fork and Clone**

    ```bash
    git clone https://github.com/YOUR_USERNAME/WingTechBot-MK3.git
    cd WingTechBot-MK3
    ```

2. **Install Dependencies**

    ```bash
    pnpm install
    ```

3. **Environment Setup**

    ```bash
    # Copy environment template
    cp packages/backend/.env.example packages/backend/.env

    # Fill in your Discord bot token and database URL
    # See DISCORD_BOT.md for help setting up a Discord application
    ```

4. **Database Setup**

    ```bash
    pnpm db:generate
    pnpm db:push
    ```

5. **Start Development**

    ```bash
    # Start both backend and frontend
    pnpm dev:all

    # Or start individually
    pnpm dev          # Backend only
    pnpm dev:frontend # Frontend only
    ```

## 📋 Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/your-feature-name` - Feature branches
- `fix/bug-description` - Bug fix branches

### Making Changes

1. **Create a Branch**

    ```bash
    git checkout -b feature/your-amazing-feature
    ```

2. **Make Your Changes**
    - Follow the coding standards below
    - Add tests for new functionality
    - Update documentation if needed

3. **Test Your Changes**

    ```bash
    pnpm test
    pnpm lint
    pnpm format:check
    ```

4. **Commit Your Changes**

    ```bash
    git add .
    git commit -m "feat: add amazing new feature"
    ```

    Use conventional commit format:
    - `feat:` - New features
    - `fix:` - Bug fixes
    - `docs:` - Documentation changes
    - `style:` - Code style changes
    - `refactor:` - Code refactoring
    - `test:` - Test additions/changes
    - `chore:` - Build process or auxiliary tool changes

5. **Push and Create PR**

    ```bash
    git push origin feature/your-amazing-feature
    ```

    Then create a Pull Request on GitHub.

## 🎯 Coding Standards

### TypeScript Guidelines

- **No `any` types** - Always use proper typing
- **No `unknown` types** - Be specific with types
- **Prefer functional style** - Use pure functions when possible
- **Use strict TypeScript settings** - Already configured in `tsconfig.json`

### Code Style

- Use ESLint and Prettier (already configured)
- Run `pnpm lint:fix` and `pnpm format` before committing
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Architecture Guidelines

#### Backend (Hexagonal Architecture)

```
src/
├── core/              # Domain logic (pure, no dependencies)
├── application/       # Use cases and application services
├── adapters/         # External adapters (HTTP, Discord, etc.)
└── infrastructure/   # Framework code and external concerns
```

#### Frontend (Component-Driven)

```
src/
├── components/       # Reusable UI components
├── hooks/           # Custom React hooks
├── stores/          # Zustand state management

```

### Testing

- Write unit tests for core business logic
- Write integration tests for API endpoints
- Write component tests for React components
- Aim for good test coverage, but prioritize important code paths

## 🛠️ Package-Specific Guidelines

### Backend Development

- Follow hexagonal architecture principles
- Keep domain logic pure (no external dependencies)
- Use dependency injection for testability
- Handle errors gracefully with proper HTTP status codes
- Document API endpoints with OpenAPI/Swagger

### Frontend Development

- Build reusable components

- Follow React best practices (hooks, functional components)
- Use TypeScript strictly
- Ensure responsive design with Tailwind CSS

### Types Package

- Define shared types between frontend and backend
- Export types from a single index file
- Use generic types where appropriate
- Document complex types with JSDoc

## 📝 Documentation

### What to Document

- New features and their usage
- API endpoint changes
- Breaking changes
- Complex business logic
- Setup instructions for new dependencies

### Where to Document

- Code comments for complex logic
- JSDoc for public APIs
- README files for package-specific information
- `/docs` folder for comprehensive guides

## 🐛 Bug Reports

When reporting bugs, please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment information (OS, Node.js version, etc.)
- Relevant error messages or logs
- Screenshots if applicable

## 💡 Feature Requests

For feature requests, please:

- Describe the use case
- Explain why this feature would be valuable
- Provide examples of how it would be used
- Consider the scope and complexity

## 🔍 Code Review Process

### For Contributors

- Keep PRs focused and reasonably sized
- Write clear PR descriptions
- Respond to feedback constructively
- Update your branch if requested

### Review Criteria

- Code follows project standards
- Tests are included and passing
- Documentation is updated
- No breaking changes without discussion
- Security considerations are addressed

## 🚨 Security

- Never commit secrets or API keys
- Use environment variables for configuration
- Report security vulnerabilities privately
- Follow OWASP guidelines for web security

## 📞 Getting Help

- **Discord**: Join our development Discord server [link]
- **Issues**: Create a GitHub issue with the "question" label
- **Discussions**: Use GitHub Discussions for general questions

## 🎉 Recognition

Contributors will be:

- Listed in the README
- Mentioned in release notes for significant contributions
- Invited to join the core team for consistent, quality contributions

Thank you for contributing to WingTechBot MK3! 🤖✨
