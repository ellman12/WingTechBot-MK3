# Deployment Guide

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

```env
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
```

## Deployment Methods

### 1. Docker Deployment

#### Dockerfile

```dockerfile
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
```

#### Docker Compose

```yaml
version: "3.8"

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
```

#### Deployment Commands

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 2. Manual Deployment

#### Server Setup

```bash
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
```

#### Application Deployment

```bash
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
```

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

```bash
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
```

## Database Setup

### PostgreSQL Configuration

```sql
-- Create database
CREATE DATABASE wingtechbot;

-- Create user
CREATE USER wingtechbot WITH PASSWORD 'secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE wingtechbot TO wingtechbot;
```

### Database Migrations

```bash
# Run migrations
pnpm db:migrate

# Verify database connection
pnpm db:studio
```

## Reverse Proxy (Nginx)

### Nginx Configuration

```nginx
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
```

## SSL Certificate

### Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Logging

### PM2 Monitoring

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart all
```

### Health Checks

```typescript
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
```

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

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U wingtechbot wingtechbot > $BACKUP_DIR/backup_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

### Application Backups

- Regular code backups (Git)
- Configuration file backups
- Log file rotation
- Disaster recovery plan

## Troubleshooting

### Common Issues

1. **Port already in use**
    - Check running processes: `netstat -tulpn | grep :3000`
    - Kill process: `kill -9 PID`

2. **Database connection failed**
    - Verify DATABASE_URL
    - Check PostgreSQL service status
    - Verify network connectivity

3. **Discord bot not connecting**
    - Check bot token validity
    - Verify bot permissions
    - Check network connectivity

For more help, see the [Development Guide](/guide/development) or create an issue on GitHub.
