# Development Guide

This guide covers development workflows, best practices, and tools for working on WingTechBot MK3.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 14
- Git
- VS Code (recommended)

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/ellman12/WingTechBot-MK3.git
   cd WingTechBot-MK3
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp packages/backend/.env.example packages/backend/.env
   # Fill in your configuration values
   ```

4. **Set up database**

   ```bash
   pnpm db:generate
   pnpm db:push
   ```

5. **Start development servers**
   ```bash
   pnpm dev:all
   ```

## 🏗️ Project Structure

```
WingTechBot-MK3/
├── packages/
│   ├── backend/              # Express API + Discord Bot
│   │   ├── src/
│   │   │   ├── core/         # Domain logic
│   │   │   ├── application/  # Use cases
│   │   │   ├── adapters/     # External adapters
│   │   │   └── infrastructure/ # Framework code
│   │   ├── tests/            # Test files
│   │   ├── docs/             # Backend-specific docs
│   │   └── package.json
│   ├── frontend/             # React application
│   │   ├── src/
│   │   │   ├── components/   # UI components
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── stores/       # State management

│   │   └── package.json
│   └── types/                # Shared TypeScript types
│       ├── src/
│       └── package.json
├── docs/                     # Project documentation
├── package.json              # Workspace configuration
└── README.md
```

## 🛠️ Development Workflow

### Daily Development

1. **Start development servers**

   ```bash
   # All services
   pnpm dev:all

   # Individual services
   pnpm dev              # Backend only
   pnpm dev:frontend     # Frontend only
   
   ```

2. **Work on features**

   - Create feature branch: `git checkout -b feature/your-feature`
   - Make changes in appropriate package
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**

   ```bash
   pnpm test             # All tests
   pnpm test:backend     # Backend tests
   pnpm test:frontend    # Frontend tests
   ```

4. **Code quality checks**
   ```bash
   pnpm lint             # Lint all packages
   pnpm lint:fix         # Auto-fix linting issues
   pnpm format           # Format code
   pnpm format:check     # Check formatting
   ```

### Package-Specific Commands

#### Backend Development

```bash
cd packages/backend

# Development server with hot reload
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
pnpm test:watch
pnpm test:coverage

# Database operations
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed database with sample data

# Docker operations
pnpm docker:build     # Build Docker image
pnpm docker:run       # Run Docker container

# OpenAPI documentation
pnpm docs:generate    # Generate OpenAPI spec
```

#### Frontend Development

```bash
cd packages/frontend

# Development server
pnpm dev

# Build for production
pnpm build
pnpm preview          # Preview production build

# Testing
pnpm test
pnpm test:ui          # Run tests with UI


```

## 🧪 Testing Strategy

### Testing Philosophy

- **Unit tests** for business logic
- **Integration tests** for API endpoints
- **Component tests** for React components
- **E2E tests** for critical user flows

### Backend Testing

```typescript
// Unit test example
describe('GuildService', () => {
  let guildService: GuildService;
  let mockRepository: jest.Mocked<GuildRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    guildService = new GuildService(mockRepository);
  });

  describe('createGuild', () => {
    it('should create a guild with valid data', async () => {
      const guildData = createTestGuildData();
      mockRepository.create.mockResolvedValue(guildData as Guild);

      const result = await guildService.createGuild(guildData);

      expect(result).toEqual(guildData);
      expect(mockRepository.create).toHaveBeenCalledWith(guildData);
    });
  });
});

// Integration test example
describe('POST /api/guilds', () => {
  let app: Express;
  let db: TestDatabase;

  beforeAll(async () => {
    ({ app, db } = await setupTestApp());
  });

  afterAll(async () => {
    await db.cleanup();
  });

  beforeEach(async () => {
    await db.reset();
  });

  it('should create a guild', async () => {
    const guildData = createTestGuildData();

    const response = await request(app).post('/api/guilds').send(guildData).expect(201);

    expect(response.body.data).toMatchObject(guildData);
  });
});
```

### Frontend Testing

```typescript
// Component test example
describe('GuildCard', () => {
  const mockGuild = createMockGuild();

  it('should render guild information', () => {
    render(<GuildCard guild={mockGuild} />);

    expect(screen.getByText(mockGuild.name)).toBeInTheDocument();
    expect(screen.getByText(`${mockGuild.memberCount} members`)).toBeInTheDocument();
  });

  it('should handle edit action', async () => {
    const onEdit = jest.fn();
    render(<GuildCard guild={mockGuild} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith(mockGuild);
  });
});

// Hook test example
describe('useGuilds', () => {
  it('should fetch guilds on mount', async () => {
    const mockGuilds = [createMockGuild()];
    vi.mocked(guildApi.getGuilds).mockResolvedValue({ data: mockGuilds });

    const { result } = renderHook(() => useGuilds());

    await waitFor(() => {
      expect(result.current.guilds).toEqual(mockGuilds);
    });
  });
});
```

## 🎨 Code Style & Standards

### TypeScript Guidelines

```typescript
// ✅ Good: Specific types
interface CreateGuildRequest {
  id: string;
  name: string;
  ownerId: string;
  memberCount?: number;
}

// ❌ Bad: any types
function processGuild(data: any): any {
  return data;
}

// ✅ Good: Proper typing
function processGuild(data: CreateGuildRequest): Guild {
  return {
    ...data,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ✅ Good: Functional style
const getActiveGuilds = (guilds: Guild[]): Guild[] =>
  guilds.filter(guild => guild.isActive);

// ✅ Good: Pure functions
const calculateTotalMembers = (guilds: Guild[]): number =>
  guilds.reduce((total, guild) => total + guild.memberCount, 0);
```

### React Best Practices

```typescript
// ✅ Good: Functional components with hooks
const GuildList: React.FC<GuildListProps> = ({ onGuildSelect }) => {
  const { guilds, isLoading, error } = useGuilds();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="guild-list">
      {guilds.map(guild => (
        <GuildCard
          key={guild.id}
          guild={guild}
          onClick={() => onGuildSelect(guild)}
        />
      ))}
    </div>
  );
};

// ✅ Good: Custom hooks for logic
const useGuilds = () => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuilds = async () => {
      try {
        setIsLoading(true);
        const response = await guildApi.getGuilds();
        setGuilds(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuilds();
  }, []);

  return { guilds, isLoading, error };
};
```

### CSS/Styling Guidelines

```css
/* ✅ Good: Utility-first with Tailwind */
.guild-card {
  @apply rounded-lg bg-white p-4 shadow-md transition-shadow hover:shadow-lg;
}

.guild-card-header {
  @apply mb-2 flex items-center justify-between;
}

.guild-card-title {
  @apply text-lg font-semibold text-gray-900;
}

/* ✅ Good: Component-scoped styles when needed */
.guild-card:hover .guild-card-actions {
  @apply opacity-100;
}

.guild-card-actions {
  @apply opacity-0 transition-opacity duration-200;
}
```

## 🔧 Development Tools

### VS Code Extensions

Recommended extensions:

- **TypeScript**: Built-in TypeScript support
- **Prettier**: Code formatting
- **ESLint**: Linting
- **Tailwind CSS IntelliSense**: CSS class suggestions
- **Auto Rename Tag**: Automatic HTML tag renaming
- **Bracket Pair Colorizer**: Bracket highlighting
- **Git Lens**: Enhanced Git integration

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

### Debug Configuration

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/packages/backend/src/index.ts",
      "outFiles": ["${workspaceFolder}/packages/backend/dist/**/*.js"],
      "envFile": "${workspaceFolder}/packages/backend/.env",
      "runtimeArgs": ["-r", "ts-node/register"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

## 🔄 Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `chore/description` - Maintenance tasks

### Commit Messages

Follow conventional commits:

```bash
# Format: type(scope): description

feat(backend): add guild management API
fix(frontend): resolve component rendering issue
docs(readme): update installation instructions
refactor(types): simplify guild interfaces
test(backend): add integration tests for auth
chore(deps): update dependencies
```

### Pull Request Process

1. **Create feature branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make changes and commit**

   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

3. **Push and create PR**

   ```bash
   git push origin feature/amazing-feature
   ```

4. **PR Checklist**
   - [ ] Code follows style guidelines
   - [ ] Tests pass and coverage is adequate
   - [ ] Documentation is updated
   - [ ] No breaking changes (or clearly documented)
   - [ ] PR description explains the changes

## 🚀 Performance Guidelines

### Backend Performance

- Use database indexes for queries
- Implement connection pooling
- Add caching for frequently accessed data
- Use streaming for large responses
- Monitor memory usage and prevent leaks

### Frontend Performance

- Lazy load components and routes
- Optimize bundle size with code splitting
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Optimize images and assets

### Example Optimizations

```typescript
// ✅ Good: Lazy loading
const GuildDetailsPage = lazy(() => import('./GuildDetailsPage'));

// ✅ Good: Memoized component
const GuildCard = memo<GuildCardProps>(({ guild, onClick }) => {
  return (
    <div onClick={() => onClick(guild)}>
      {/* Component content */}
    </div>
  );
});

// ✅ Good: Optimized selector
const selectActiveGuilds = createSelector(
  (state: RootState) => state.guilds.items,
  (guilds) => guilds.filter(guild => guild.isActive)
);
```

## 🔍 Debugging Tips

### Backend Debugging

```typescript
// Add debug logging
const debug = require('debug')('wingtechbot:guild');

debug('Creating guild: %O', guildData);

// Use debugger statements
function processGuild(guild: Guild) {
  debugger; // Will break in debugger when NODE_ENV=development
  // Process guild...
}

// Monitor database queries
if (process.env.NODE_ENV === 'development') {
  kysely.on('query', event => {
    console.log('SQL:', event.sql);
    console.log('Parameters:', event.parameters);
  });
}
```

### Frontend Debugging

```typescript
// React DevTools profiling
import { Profiler } from 'react';

const onRenderCallback = (id: string, phase: string, actualDuration: number) => {
  console.log('Component render:', { id, phase, actualDuration });
};

<Profiler id="GuildList" onRender={onRenderCallback}>
  <GuildList />
</Profiler>

// Debug state changes
const useDebugValue = (value: any, formatter?: (value: any) => any) => {
  React.useDebugValue(value, formatter);
};

// Component debugging
const GuildCard = ({ guild }: GuildCardProps) => {
  useDebugValue(guild, guild => guild.name);
  // Component implementation...
};
```

## 📦 Dependency Management

### Adding Dependencies

```bash
# Add to workspace root (affects all packages)
pnpm add -w dependency-name

# Add to specific package
pnpm add --filter backend dependency-name
pnpm add --filter frontend dependency-name

# Add dev dependency
pnpm add -D --filter backend dependency-name
```

### Version Management

- Use exact versions for critical dependencies
- Pin TypeScript and testing framework versions
- Use ranges for utility libraries
- Document version choices in package.json comments

```json
{
  "dependencies": {
    "discord.js": "14.13.0",
    "express": "^4.18.2",
    "prisma": "5.5.2"
  }
}
```

For additional development resources and troubleshooting, see the project's GitHub wiki and issues.
