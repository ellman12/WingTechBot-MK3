// Import markdown content as strings
import quickStartContent from '../content/quick-start.md?raw'
import developmentContent from '../content/development.md?raw'
import architectureContent from '../content/architecture.md?raw'

// Content map for easy access
export const MARKDOWN_CONTENT = {
  'quick-start': quickStartContent,
  'development': developmentContent,
  'architecture': architectureContent,
  'installation': `# Installation

## Prerequisites

Before installing WingTechBot MK3, ensure you have the following:

- **Node.js** (>= 18.0.0)
- **pnpm** (install with \`npm install -g pnpm\`)
- **PostgreSQL** (>= 14.0.0)
- **Git**
- **Docker** (optional, for containerized deployment)

## Step-by-Step Installation

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/ellman12/WingTechBot-MK3.git
cd WingTechBot-MK3
\`\`\`

### 2. Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

### 3. Environment Configuration

Create a \`.env\` file in the backend directory:

\`\`\`bash
cp packages/backend/.env.example packages/backend/.env
\`\`\`

Edit the \`.env\` file with your configuration:

\`\`\`env
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/wingtechbot"

# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id
\`\`\`

### 4. Database Setup

\`\`\`bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push
\`\`\`

### 5. Start Development

\`\`\`bash
# Start all services
pnpm dev:all

# Or start individually
pnpm dev         # Backend only
pnpm dev:frontend # Frontend only
\`\`\`

## Verification

After installation, verify everything is working:

- **Backend API:** http://localhost:3000
- **Frontend:** http://localhost:5173
- **API Docs:** http://localhost:3000/api/docs

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Ensure PostgreSQL is running
   - Verify DATABASE_URL in .env
   - Check database permissions

2. **Discord Bot Not Connecting**
   - Verify DISCORD_TOKEN is correct
   - Check bot permissions in Discord Developer Portal
   - Ensure bot is added to your server

3. **Port Already in Use**
   - Change PORT in .env file
   - Kill existing processes using the port

For more help, see the [Development Guide](/guide/development) or create an issue on GitHub.`,
  'database': `# Database Guide

## Overview

WingTechBot MK3 uses PostgreSQL as its primary database with Prisma as the ORM and Kysely for type-safe SQL queries.

## Database Schema

### Core Tables

\`\`\`sql
-- Users table
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  discord_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guilds table
CREATE TABLE guilds (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Database Operations

### Using Prisma

\`\`\`typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Create a user
const user = await prisma.user.create({
  data: {
    id: 'user123',
    username: 'example_user',
    discordId: 'discord123'
  }
})

// Find user by Discord ID
const user = await prisma.user.findUnique({
  where: { discordId: 'discord123' }
})
\`\`\`

### Using Kysely

\`\`\`typescript
import { db } from '../infrastructure/database'

// Type-safe queries
const users = await db
  .selectFrom('users')
  .select(['id', 'username', 'discord_id'])
  .where('created_at', '>', new Date('2024-01-01'))
  .execute()
\`\`\`

## Migrations

### Creating Migrations

\`\`\`bash
# Generate migration from schema changes
pnpm db:migrate:create

# Apply migrations
pnpm db:migrate

# Rollback migrations
pnpm db:migrate:rollback
\`\`\`

### Migration Best Practices

1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Use descriptive migration names**
4. **Include rollback scripts**

## Performance Optimization

### Indexing

\`\`\`sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_discord_id ON users(discord_id);
CREATE INDEX idx_guilds_owner_id ON guilds(owner_id);
\`\`\`

### Query Optimization

- Use SELECT only needed columns
- Implement pagination for large datasets
- Use database transactions for related operations
- Monitor slow queries with logging

## Backup and Recovery

### Automated Backups

\`\`\`bash
# Create backup
pg_dump -h localhost -U username wingtechbot > backup.sql

# Restore from backup
psql -h localhost -U username wingtechbot < backup.sql
\`\`\`

### Backup Strategy

- **Daily backups** for production
- **Point-in-time recovery** for critical data
- **Test restore procedures** regularly
- **Store backups securely** with encryption

For more advanced database operations, see the [Development Guide](/guide/development).`,
  'discord-bot': `# Discord Bot Guide

## Overview

The WingTechBot MK3 Discord bot provides voice channel management, moderation tools, and custom commands.

## Bot Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your application (e.g., "WingTechBot MK3")
4. Go to "Bot" section and create a bot

### 2. Configure Bot Permissions

Required permissions:

\`\`\`
- Send Messages
- Use Slash Commands
- Connect to Voice Channels
- Speak in Voice Channels
- Manage Messages
- Read Message History
\`\`\`

### 3. Add Bot to Server

1. Go to "OAuth2" > "URL Generator"
2. Select "bot" scope
3. Select required permissions
4. Use generated URL to add bot to your server

## Slash Commands

### Voice Commands

\`\`\`
/join - Join voice channel
/leave - Leave voice channel
/play <url> - Play audio from URL
/pause - Pause current audio
/resume - Resume paused audio
/stop - Stop and clear queue
/skip - Skip current track
/queue - Show current queue
\`\`\`

### Moderation Commands

\`\`\`
/kick <user> [reason] - Kick user from server
/ban <user> [reason] - Ban user from server
/timeout <user> <duration> [reason] - Timeout user
/clear <amount> - Clear messages
\`\`\`

### Utility Commands

\`\`\`
/ping - Check bot latency
/info - Show server information
/userinfo <user> - Show user information
/help - Show command help
\`\`\`

## Adding Custom Commands

### Command Structure

\`\`\`typescript
import { SlashCommandBuilder } from 'discord.js'

const customCommand = {
  data: new SlashCommandBuilder()
    .setName('custom')
    .setDescription('Custom command description')
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Input description')
        .setRequired(true)
    ),
  
  execute: async (interaction) => {
    const input = interaction.options.getString('input')
    await interaction.reply(\`You said: \${input}\`)
  }
}
\`\`\`

### Registering Commands

\`\`\`bash
# Deploy commands to Discord
pnpm discord:deploy-commands
\`\`\`

## Event Handling

### Common Events

\`\`\`typescript
// Ready event
client.on('ready', () => {
  console.log(\`Logged in as \${client.user?.tag}\`)
})

// Message event
client.on('messageCreate', async (message) => {
  if (message.author.bot) return
  
  // Handle message
})

// Voice state update
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Handle voice channel changes
})
\`\`\`

## Voice Features

### Audio Playback

\`\`\`typescript
import { createAudioPlayer, createAudioResource } from '@discordjs/voice'

const player = createAudioPlayer()
const resource = createAudioResource('audio.mp3')

player.play(resource)
connection.subscribe(player)
\`\`\`

### Queue Management

\`\`\`typescript
class MusicQueue {
  private queue: AudioResource[] = []
  
  add(track: AudioResource) {
    this.queue.push(track)
  }
  
  next(): AudioResource | undefined {
    return this.queue.shift()
  }
}
\`\`\`

## Error Handling

### Best Practices

1. **Always handle promise rejections**
2. **Use try-catch blocks for async operations**
3. **Log errors for debugging**
4. **Provide user-friendly error messages**

\`\`\`typescript
try {
  await interaction.reply('Command executed successfully')
} catch (error) {
  console.error('Command error:', error)
  await interaction.reply({
    content: 'An error occurred while executing this command.',
    ephemeral: true
  })
}
\`\`\`

## Deployment

### Environment Variables

\`\`\`env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
\`\`\`

### Production Considerations

- Use process managers (PM2, systemd)
- Implement health checks
- Monitor bot performance
- Set up logging and alerts

For more details, see the [Development Guide](/guide/development) and [Deployment Guide](/guide/deployment).`,
  'frontend': `# Frontend Development Guide

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

\`\`\`
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
\`\`\`

## Component Development

### Functional Components

\`\`\`typescript
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
      className={\`btn btn-\${variant}\`}
    >
      {children}
    </button>
  )
}
\`\`\`

### Custom Hooks

\`\`\`typescript
import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }

  return [storedValue, setValue] as const
}
\`\`\`

## State Management

### Zustand Store

\`\`\`typescript
import { create } from 'zustand'

interface UserStore {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: false,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading })
}))
\`\`\`

### Using Stores

\`\`\`typescript
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
\`\`\`

## Data Fetching

### TanStack Query

\`\`\`typescript
import { useQuery, useMutation } from '@tanstack/react-query'

// Fetching data
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(res => res.json())
  })
}

// Mutating data
export const useCreateUser = () => {
  return useMutation({
    mutationFn: (userData: CreateUserData) =>
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      }).then(res => res.json()),
    onSuccess: () => {
      // Invalidate and refetch users
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}
\`\`\`

## Styling

### Tailwind CSS

\`\`\`typescript
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
\`\`\`

### Custom CSS

\`\`\`css
/* Custom component styles */
.btn {
  @apply px-4 py-2 rounded font-medium transition-colors;
}

.btn-primary {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.btn-secondary {
  @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
}
\`\`\`

## Testing

### Component Testing

\`\`\`typescript
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
\`\`\`

## Performance Optimization

### Code Splitting

\`\`\`typescript
import { lazy, Suspense } from 'react'

const LazyComponent = lazy(() => import('./LazyComponent'))

export const App = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <LazyComponent />
  </Suspense>
)
\`\`\`

### Memoization

\`\`\`typescript
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
\`\`\`

## Build and Deployment

### Development

\`\`\`bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
\`\`\`

### Environment Variables

\`\`\`env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=WingTechBot MK3
\`\`\`

For more advanced frontend development, see the [Development Guide](/guide/development).`,
  'deployment': `# Deployment Guide

## Overview

This guide covers deploying WingTechBot MK3 to production environments using various methods.

## Prerequisites

- **Production server** (VPS, cloud instance, etc.)
- **Domain name** (optional but recommended)
- **SSL certificate** (Let's Encrypt recommended)
- **PostgreSQL database** (managed or self-hosted)
- **Discord bot application** configured

## Environment Setup

### Production Environment Variables

\`\`\`env
# Server Configuration
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com

# Database
DATABASE_URL=postgresql://username:password@host:5432/wingtechbot

# Discord Bot
DISCORD_TOKEN=your_production_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# Security
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
\`\`\`

## Deployment Methods

### 1. Docker Deployment

#### Dockerfile

\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Expose port
EXPOSE 3000

# Start application
CMD ["pnpm", "start"]
\`\`\`

#### Docker Compose

\`\`\`yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/wingtechbot
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=wingtechbot
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
\`\`\`

#### Deployment Commands

\`\`\`bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
\`\`\`

### 2. Manual Deployment

#### Server Setup

\`\`\`bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install PM2
npm install -g pm2
\`\`\`

#### Application Deployment

\`\`\`bash
# Clone repository
git clone https://github.com/ellman12/WingTechBot-MK3.git
cd WingTechBot-MK3

# Install dependencies
pnpm install

# Build application
pnpm build

# Set up environment variables
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
\`\`\`

### 3. Cloud Platform Deployment

#### Railway

1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically on push

#### Render

1. Create new Web Service
2. Connect repository
3. Configure build and start commands
4. Set environment variables

#### Heroku

\`\`\`bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Deploy
git push heroku main
\`\`\`

## Database Setup

### PostgreSQL Configuration

\`\`\`sql
-- Create database
CREATE DATABASE wingtechbot;

-- Create user
CREATE USER wingtechbot WITH PASSWORD 'secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE wingtechbot TO wingtechbot;
\`\`\`

### Database Migrations

\`\`\`bash
# Run migrations
pnpm db:migrate

# Verify database connection
pnpm db:studio
\`\`\`

## Reverse Proxy (Nginx)

### Nginx Configuration

\`\`\`nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

## SSL Certificate

### Let's Encrypt

\`\`\`bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
\`\`\`

## Monitoring and Logging

### PM2 Monitoring

\`\`\`bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart all
\`\`\`

### Health Checks

\`\`\`typescript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})
\`\`\`

## Security Considerations

### Environment Security

- Use strong, unique passwords
- Store secrets in environment variables
- Never commit secrets to version control
- Use secrets management services

### Network Security

- Configure firewall rules
- Use HTTPS everywhere
- Implement rate limiting
- Regular security updates

### Application Security

- Validate all inputs
- Use parameterized queries
- Implement proper authentication
- Regular dependency updates

## Backup Strategy

### Database Backups

\`\`\`bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U wingtechbot wingtechbot > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
\`\`\`

### Application Backups

- Regular code backups (Git)
- Configuration file backups
- Log file rotation
- Disaster recovery plan

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Check running processes: \`netstat -tulpn | grep :3000\`
   - Kill process: \`kill -9 PID\`

2. **Database connection failed**
   - Verify DATABASE_URL
   - Check PostgreSQL service status
   - Verify network connectivity

3. **Discord bot not connecting**
   - Check bot token validity
   - Verify bot permissions
   - Check network connectivity

For more help, see the [Development Guide](/guide/development) or create an issue on GitHub.`,
} as const

export type MarkdownPath = keyof typeof MARKDOWN_CONTENT

export function loadMarkdownContent(path: MarkdownPath): string {
  return MARKDOWN_CONTENT[path] || `# Content Not Found\n\nThe requested content could not be loaded.`
} 