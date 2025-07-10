# Frontend Development Guide

This guide covers frontend development for the WingTechBot MK3 React application.

## 🎨 Frontend Overview

The frontend is a modern React application featuring:

- **React 19** with functional components and hooks
- **TypeScript** for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Zustand** for state management
- **TanStack Query** for data fetching

## 🚀 Getting Started

### Development Setup

```bash
cd packages/frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev


```

### Project Structure

```
packages/frontend/src/
├── components/           # UI components
│   ├── common/          # Reusable components
│   ├── layout/          # Layout components
│   └── features/        # Feature-specific components
├── hooks/               # Custom React hooks
│   ├── api/             # API-related hooks
│   ├── form/            # Form handling hooks
│   └── ui/              # UI-related hooks
├── stores/              # Zustand state stores
├── utils/               # Utility functions
├── types/               # Frontend-specific types

├── App.tsx              # Main application
└── main.tsx            # Application entry point
```

## 🧩 Component Architecture

### Component Guidelines

```typescript
// ✅ Good: Functional component with proper types
interface GuildCardProps {
  guild: Guild;
  onSelect?: (guild: Guild) => void;
  onEdit?: (guild: Guild) => void;
  onDelete?: (guild: Guild) => void;
  className?: string;
}

export const GuildCard: React.FC<GuildCardProps> = ({
  guild,
  onSelect,
  onEdit,
  onDelete,
  className
}) => {
  return (
    <div
      className={cn("bg-white rounded-lg shadow-md p-4", className)}
      onClick={() => onSelect?.(guild)}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{guild.name}</h3>
        <span className="text-sm text-gray-500">
          {guild.memberCount} members
        </span>
      </div>

      {(onEdit || onDelete) && (
        <div className="mt-4 flex gap-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(guild);
              }}
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(guild);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
```

### Compound Components

```typescript
// Compound component pattern for flexible composition
export const GuildCard = {
  Root: ({ children, guild, className }: GuildCardRootProps) => (
    <div className={cn("bg-white rounded-lg shadow-md p-4", className)}>
      {children}
    </div>
  ),

  Header: ({ guild }: { guild: Guild }) => (
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-lg font-semibold">{guild.name}</h3>
      <Badge variant="secondary">{guild.memberCount} members</Badge>
    </div>
  ),

  Content: ({ guild }: { guild: Guild }) => (
    <div className="text-sm text-gray-600">
      <p>Owner: {guild.ownerId}</p>
      <p>Created: {format(guild.createdAt, 'MMM dd, yyyy')}</p>
    </div>
  ),

  Actions: ({ guild, onEdit, onDelete }: GuildCardActionsProps) => (
    <div className="mt-4 flex gap-2">
      {onEdit && (
        <Button variant="outline" size="sm" onClick={() => onEdit(guild)}>
          Edit
        </Button>
      )}
      {onDelete && (
        <Button variant="destructive" size="sm" onClick={() => onDelete(guild)}>
          Delete
        </Button>
      )}
    </div>
  ),
};

// Usage
<GuildCard.Root guild={guild}>
  <GuildCard.Header guild={guild} />
  <GuildCard.Content guild={guild} />
  <GuildCard.Actions guild={guild} onEdit={handleEdit} onDelete={handleDelete} />
</GuildCard.Root>
```

## 🎣 Custom Hooks

### API Hooks

```typescript
// hooks/api/useGuilds.ts
export function useGuilds() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['guilds'],
    queryFn: async () => {
      const response = await fetch('/api/guilds');
      if (!response.ok) throw new Error('Failed to fetch guilds');
      return response.json();
    },
  });

  return {
    guilds: data?.data || [],
    error,
    isLoading,
    refetch,
  };
}

// hooks/api/useGuildMutations.ts
export function useGuildMutations() {
  const queryClient = useQueryClient();

  const createGuild = useMutation({
    mutationFn: async (guildData: CreateGuildData) => {
      const response = await fetch('/api/guilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guildData),
      });
      if (!response.ok) throw new Error('Failed to create guild');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      toast.success('Guild created successfully!');
    },
    onError: error => {
      toast.error(`Failed to create guild: ${error.message}`);
    },
  });

  const updateGuild = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateGuildData }) => {
      const response = await fetch(`/api/guilds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update guild');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      toast.success('Guild updated successfully!');
    },
  });

  return { createGuild, updateGuild };
}
```

### Form Hooks

```typescript
// hooks/form/useGuildForm.ts
export function useGuildForm(initialData?: Partial<Guild>) {
  const form = useForm<GuildFormData>({
    defaultValues: {
      name: initialData?.name || '',
      memberCount: initialData?.memberCount || 0,
    },
    resolver: zodResolver(guildFormSchema),
  });

  const { createGuild, updateGuild } = useGuildMutations();

  const onSubmit = async (data: GuildFormData) => {
    try {
      if (initialData?.id) {
        await updateGuild.mutateAsync({ id: initialData.id, data });
      } else {
        await createGuild.mutateAsync({
          ...data,
          id: generateGuildId(),
          ownerId: getCurrentUserId(),
        });
      }
      form.reset();
    } catch (error) {
      // Error handling is done in mutations
    }
  };

  return {
    form,
    onSubmit: form.handleSubmit(onSubmit),
    isSubmitting: createGuild.isPending || updateGuild.isPending,
  };
}
```

### UI Hooks

```typescript
// hooks/ui/useModal.ts
export function useModal() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}

// hooks/ui/useLocalStorage.ts
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}
```

## 🗃️ State Management

### Zustand Stores

```typescript
// stores/guildStore.ts
interface GuildStore {
  // State
  selectedGuild: Guild | null;
  filters: GuildFilters;

  // Actions
  selectGuild: (guild: Guild | null) => void;
  setFilters: (filters: Partial<GuildFilters>) => void;
  resetFilters: () => void;
}

export const useGuildStore = create<GuildStore>(set => ({
  selectedGuild: null,
  filters: {
    search: '',
    isActive: true,
    sortBy: 'name',
    sortOrder: 'asc',
  },

  selectGuild: guild => set({ selectedGuild: guild }),

  setFilters: newFilters =>
    set(state => ({
      filters: { ...state.filters, ...newFilters },
    })),

  resetFilters: () =>
    set({
      filters: {
        search: '',
        isActive: true,
        sortBy: 'name',
        sortOrder: 'asc',
      },
    }),
}));

// stores/uiStore.ts
interface UIStore {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;

  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    set => ({
      theme: 'light',
      sidebarOpen: true,

      toggleTheme: () =>
        set(state => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

      setSidebarOpen: open => set({ sidebarOpen: open }),
    }),
    {
      name: 'ui-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

## 🎨 Styling with Tailwind CSS

### Design System

```typescript
// utils/cn.ts (class name utility)
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Design tokens in tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        gray: {
          50: '#f9fafb',
          500: '#6b7280',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
};
```

### Component Variants

```typescript
// components/common/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

## 📱 Responsive Design

```typescript
// Responsive component example
export const GuildGrid: React.FC<{ guilds: Guild[] }> = ({ guilds }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {guilds.map(guild => (
        <GuildCard key={guild.id} guild={guild} />
      ))}
    </div>
  );
};

// Responsive layout hooks
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<'sm' | 'md' | 'lg' | 'xl'>('sm');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width >= 1280) setBreakpoint('xl');
      else if (width >= 1024) setBreakpoint('lg');
      else if (width >= 768) setBreakpoint('md');
      else setBreakpoint('sm');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
}
```

## 🧪 Testing

### Component Testing

```typescript
// __tests__/GuildCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GuildCard } from '../components/features/GuildCard';

const mockGuild = {
  id: '123',
  name: 'Test Guild',
  ownerId: '456',
  memberCount: 100,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GuildCard', () => {
  it('renders guild information', () => {
    render(<GuildCard guild={mockGuild} />);

    expect(screen.getByText('Test Guild')).toBeInTheDocument();
    expect(screen.getByText('100 members')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<GuildCard guild={mockGuild} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(mockGuild);
  });

  it('shows action buttons when provided', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <GuildCard guild={mockGuild} onEdit={onEdit} onDelete={onDelete} />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});
```

### Hook Testing

```typescript
// __tests__/hooks/useGuilds.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGuilds } from '../hooks/api/useGuilds';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useGuilds', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('fetches guilds successfully', async () => {
    const mockGuilds = [mockGuild];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockGuilds }),
    });

    const { result } = renderHook(() => useGuilds(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.guilds).toEqual(mockGuilds);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
```

## 🚀 Performance Optimization

### Code Splitting

```typescript
// Lazy load pages
const GuildListPage = lazy(() => import('./pages/GuildListPage'));
const GuildDetailPage = lazy(() => import('./pages/GuildDetailPage'));

// Route-based splitting
export const App = () => (
  <Router>
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/guilds" element={<GuildListPage />} />
        <Route path="/guilds/:id" element={<GuildDetailPage />} />
      </Routes>
    </Suspense>
  </Router>
);
```

### Memoization

```typescript
// Memoize expensive components
export const GuildCard = memo<GuildCardProps>(({ guild, onSelect }) => {
  return (
    <div onClick={() => onSelect?.(guild)}>
      {/* Component content */}
    </div>
  );
});

// Memoize expensive calculations
export const GuildStats = ({ guilds }: { guilds: Guild[] }) => {
  const stats = useMemo(() => {
    return {
      total: guilds.length,
      active: guilds.filter(g => g.isActive).length,
      totalMembers: guilds.reduce((sum, g) => sum + g.memberCount, 0),
    };
  }, [guilds]);

  return <div>{/* Render stats */}</div>;
};
```

### Virtual Scrolling

```typescript
// For large lists
import { FixedSizeList as List } from 'react-window';

export const VirtualizedGuildList = ({ guilds }: { guilds: Guild[] }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <GuildCard guild={guilds[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={guilds.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

## 📦 Build & Deployment

### Vite Configuration

```typescript
// vite.config.ts
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### Environment Variables

```typescript
// src/config/env.ts
const env = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  APP_ENV: import.meta.env.MODE,
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
} as const;

export default env;
```

This guide provides a comprehensive foundation for frontend development in the WingTechBot MK3 project. For additional help, see the React, Vite, and Tailwind CSS documentation.
