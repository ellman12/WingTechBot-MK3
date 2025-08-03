# Frontend Development Guide

## Overview

The WingTechBot MK3 frontend is a modern React application built with TypeScript, Vite, and Tailwind CSS.

## Technology Stack

- **React 19** - UI library with hooks
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Zustand** - State management
- **TanStack Query** - Data fetching and caching

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── common/       # Generic components
│   ├── layout/       # Layout components
│   └── features/     # Feature-specific components
├── hooks/            # Custom React hooks
├── stores/           # Zustand state stores
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── App.tsx           # Main application
└── main.tsx          # Application entry point
```

## Component Development

### Functional Components

```typescript
import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  )
}
```

### Custom Hooks

```typescript
import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue] as const;
}
```

## State Management

### Zustand Store

```typescript
import { create } from "zustand";

interface UserStore {
    user: User | null;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
}

export const useUserStore = create<UserStore>(set => ({
    user: null,
    isLoading: false,
    setUser: user => set({ user }),
    setLoading: isLoading => set({ isLoading }),
}));
```

### Using Stores

```typescript
import { useUserStore } from '../stores/userStore'

export const UserProfile = () => {
  const { user, setUser } = useUserStore()

  if (!user) return <div>Please log in</div>

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={() => setUser(null)}>Logout</button>
    </div>
  )
}
```

## Data Fetching

### TanStack Query

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";

// Fetching data
export const useUsers = () => {
    return useQuery({
        queryKey: ["users"],
        queryFn: () => fetch("/api/users").then(res => res.json()),
    });
};

// Mutating data
export const useCreateUser = () => {
    return useMutation({
        mutationFn: (userData: CreateUserData) =>
            fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData),
            }).then(res => res.json()),
        onSuccess: () => {
            // Invalidate and refetch users
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
};
```

## Styling

### Tailwind CSS

```typescript
// Utility classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h2 className="text-xl font-semibold text-gray-900">Title</h2>
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Action
  </button>
</div>

// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content */}
</div>
```

### Custom CSS

```css
/* Custom component styles */
.btn {
    @apply rounded px-4 py-2 font-medium transition-colors;
}

.btn-primary {
    @apply bg-blue-500 text-white hover:bg-blue-600;
}

.btn-secondary {
    @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
}
```

## Testing

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

test('renders button with correct text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})

test('calls onClick when clicked', () => {
  const handleClick = jest.fn()
  render(<Button onClick={handleClick}>Click me</Button>)

  fireEvent.click(screen.getByText('Click me'))
  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

## Performance Optimization

### Code Splitting

```typescript
import { lazy, Suspense } from 'react'

const LazyComponent = lazy(() => import('./LazyComponent'))

export const App = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <LazyComponent />
  </Suspense>
)
```

### Memoization

```typescript
import { memo, useMemo, useCallback } from 'react'

const ExpensiveComponent = memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return data.map(item => item * 2)
  }, [data])

  const handleClick = useCallback(() => {
    onUpdate(processedData)
  }, [processedData, onUpdate])

  return <div onClick={handleClick}>{/* Component content */}</div>
})
```

## Build and Deployment

### Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Environment Variables

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=WingTechBot MK3
```

For more advanced frontend development, see the [Development Guide](/guide/development).
