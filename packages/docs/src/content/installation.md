# Installation Guide

## Prerequisites

Before installing WingTechBot MK3, ensure you have the following software installed:

### Required Software

- **Node.js** (version 18.0.0 or higher)
- **pnpm** (install with `npm install -g pnpm`)
- **Docker**
- **Git** for version control
- **Docker** (optional, for containerized deployment)

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: At least 2GB free disk space
- **Network**: Internet connection for package installation

## Step-by-Step Installation

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/ellman12/WingTechBot-MK3.git

# Navigate to the project directory
cd WingTechBot-MK3
```

### 2. Install Dependencies

```bash
# Install all dependencies using pnpm
pnpm install
```

This will install dependencies for all packages in the monorepo:

- Backend API and Discord bot
- Frontend React application
- Shared TypeScript types
- Documentation site

### 3. Environment Configuration

#### Backend Environment Setup

Create a `.env` file in the backend directory:

```bash
# Copy the example environment file
cp packages/backend/.env.example packages/backend/.env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/wingtechbot"

# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id

# Security (for production)
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
```

#### Frontend Environment Setup

Create a `.env` file in the frontend directory:

```bash
# Copy the example environment file
cp packages/frontend/.env.example packages/frontend/.env
```

Edit the `.env` file:

```env
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=WingTechBot MK3

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true
```

### 4. Database Setup

#### PostgreSQL Installation

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS (using Homebrew):**

```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

#### Database Creation

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE wingtechbot;
CREATE USER wingtechbot WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE wingtechbot TO wingtechbot;
\q
```

#### Database Schema Setup

```bash
pnpm db:generate

# Push schema to database
pnpm db:push

# (Optional) Run seed data
pnpm db:seed
```

### 5. Discord Bot Setup

#### Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your application (e.g., "WingTechBot MK3")
4. Go to the "Bot" section and click "Add Bot"
5. Copy the bot token and client ID

#### Configure Bot Permissions

Required permissions for the bot:

```
- Send Messages
- Use Slash Commands
- Connect to Voice Channels
- Speak in Voice Channels
- Manage Messages
- Read Message History
- View Channels
- Embed Links
- Attach Files
- Use External Emojis
- Add Reactions
```

#### Add Bot to Your Server

1. Go to "OAuth2" > "URL Generator"
2. Select "bot" scope
3. Select the required permissions
4. Use the generated URL to add the bot to your server

### 6. Start Development

#### Start All Services

```bash
# Start all services (backend, frontend, Discord bot)
pnpm dev:all
```

#### Start Services Individually

```bash
# Backend only
pnpm dev

# Frontend only
pnpm dev:frontend

# Discord bot only
pnpm dev:bot
```

## Verification

After installation, verify everything is working:

### Check Services

- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173
- **API Documentation**: http://localhost:3000/api/docs
- **Database**: Check connection with `pnpm db:studio`

### Test Discord Bot

1. Invite the bot to your server
2. Try the `/ping` command
3. Check bot status in Discord

### Verify API Endpoints

```bash
# Test health endpoint
curl http://localhost:3000/api/v1/health

# Test API documentation
curl http://localhost:3000/api/docs
```

## Troubleshooting

### Common Issues

#### Database Connection Failed

**Symptoms**: Error connecting to PostgreSQL

**Solutions**:

```bash
# Check PostgreSQL service status
sudo systemctl status postgresql

# Verify connection string
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL
```

#### Discord Bot Not Connecting

**Symptoms**: Bot appears offline or commands don't work

**Solutions**:

- Verify `DISCORD_TOKEN` is correct
- Check bot permissions in Discord Developer Portal
- Ensure bot is added to your server
- Check network connectivity

#### Port Already in Use

**Symptoms**: "EADDRINUSE" error

**Solutions**:

```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env file
PORT=3001
```

#### pnpm Installation Issues

**Symptoms**: Package installation fails

**Solutions**:

```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules
pnpm install
```

### Performance Issues

#### Slow Development Server

**Solutions**:

- Use SSD storage
- Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`
- Disable unnecessary features in development

#### Database Performance

**Solutions**:

- Add database indexes
- Optimize queries
- Use connection pooling
- Monitor slow queries

## Next Steps

After successful installation:

1. **Read the Development Guide**: Learn about the codebase structure and development workflow
2. **Explore the API**: Check out the API documentation for available endpoints
3. **Customize Configuration**: Modify settings to match your requirements
4. **Set Up Monitoring**: Configure logging and monitoring for production use
5. **Deploy to Production**: Follow the deployment guide for production setup

## Support

If you encounter issues during installation:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review the [Development Guide](/guide/development)
3. Search existing [GitHub issues](https://github.com/ellman12/WingTechBot-MK3/issues)
4. Create a new issue with detailed error information

For additional help, join our Discord server or check the project documentation.
