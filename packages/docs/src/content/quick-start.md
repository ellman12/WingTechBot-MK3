# Quick Start Guide

## 📋 Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (>= 18.0.0)
- **pnpm** (install with `npm install -g pnpm`)
- **Git**
- **Docker**
- **Discord Application** (for bot token)

## 🚀 1. Clone and Install

```bash
git clone https://github.com/ellman12/WingTechBot-MK3.git
cd WingTechBot-MK3
pnpm install
```

## ⚙️ 2. Environment Setup

Create a `.env` file in the **backend** directory with the following content:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL="postgresql://wingtechbot:wingtechbot_password@localhost:5432/wingtechbot"

# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id (optional, for development)
```

You can get your Discord credentials from the [Discord Developer Portal](https://discord.com/developers/applications).

## 🗄️ 3. Database Setup

```bash
pnpm db:generate
pnpm db:push
```

Ensure PostgreSQL is running and accessible at the URL you set in `DATABASE_URL`.

## 💻 4. Start Development

```bash
pnpm dev:all
```

Or start services individually:

```bash
pnpm dev         # Backend only
pnpm dev:frontend # Frontend only
```

## 🌐 What to Expect

- **Backend API:** [http://localhost:3000](http://localhost:3000)
- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **API Docs:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

If everything is running, you should see the API docs and the React frontend. The Discord bot will connect automatically if your credentials are correct.

## ❓ Troubleshooting & Next Steps

- Check `pnpm dev:all` output for errors.
- Verify your `.env` values, especially Discord and database credentials.
- See **Development** and **Discord Bot** guides for advanced usage.
- For Docker setup, see the **Deployment** guide.

Ready to contribute? Check out the [Development](/guide/development) and [Discord Bot](/guide/discord-bot) guides for more details! 