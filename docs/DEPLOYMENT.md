# Deployment Guide

This guide covers deploying WingTechBot MK3 to production environments.

## 🏗️ Architecture Overview

WingTechBot MK3 consists of several components that need to be deployed:

- **Backend API** - Express.js server
- **Discord Bot** - Discord.js bot client
- **Frontend** - React application
- **Database** - PostgreSQL database
- **Static Assets** - Built frontend files

## 🐳 Docker Deployment (Recommended)

### Backend + Discord Bot

The backend includes both the API server and Discord bot in a single container.

1. **Build the Docker Image**

    ```bash
    cd packages/backend
    docker build -t wingtechbot-backend:latest .
    ```

2. **Run with Docker Compose**

    ```yaml
    # docker-compose.prod.yml
    version: "3.8"

    services:
        backend:
            image: wingtechbot-backend:latest
            ports:
                - "3000:3000"
            environment:
                - NODE_ENV=production
                - PORT=3000
                - DATABASE_URL=postgresql://user:password@db:5432/wingtechbot
                - DISCORD_TOKEN=your_discord_token
                - DISCORD_CLIENT_ID=your_client_id
                - DISCORD_GUILD_ID=your_guild_id
            depends_on:
                - db
            restart: unless-stopped

        db:
            image: postgres:15
            environment:
                - POSTGRES_DB=wingtechbot
                - POSTGRES_USER=user
                - POSTGRES_PASSWORD=password
            volumes:
                - postgres_data:/var/lib/postgresql/data
            restart: unless-stopped

        frontend:
            image: nginx:alpine
            ports:
                - "80:80"
                - "443:443"
            volumes:
                - ./nginx.conf:/etc/nginx/nginx.conf
                - ./frontend-dist:/usr/share/nginx/html
                - ./ssl:/etc/nginx/ssl
            depends_on:
                - backend
            restart: unless-stopped

    volumes:
        postgres_data:
    ```

3. **Deploy**
    ```bash
    docker-compose -f docker-compose.prod.yml up -d
    ```

### Frontend (Static Hosting)

The frontend can be deployed to any static hosting service:

1. **Build for Production**

    ```bash
    cd packages/frontend
    pnpm build
    ```

2. **Deploy to Static Hosting**
    - **Vercel**: `vercel --prod`
    - **Netlify**: Drag `dist` folder to Netlify dashboard
    - **AWS S3**: `aws s3 sync dist/ s3://your-bucket/`
    - **GitHub Pages**: Push `dist` contents to `gh-pages` branch

## ☁️ Cloud Platform Deployments

### AWS Deployment

#### Backend on ECS

1. **Create ECR Repository**

    ```bash
    aws ecr create-repository --repository-name wingtechbot-backend
    ```

2. **Push Docker Image**

    ```bash
    # Get login token
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

    # Tag and push
    docker tag wingtechbot-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/wingtechbot-backend:latest
    docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/wingtechbot-backend:latest
    ```

3. **Create ECS Task Definition**
    ```json
    {
        "family": "wingtechbot-backend",
        "networkMode": "awsvpc",
        "requiresCompatibilities": ["FARGATE"],
        "cpu": "256",
        "memory": "512",
        "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
        "containerDefinitions": [
            {
                "name": "wingtechbot-backend",
                "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/wingtechbot-backend:latest",
                "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
                "environment": [{ "name": "NODE_ENV", "value": "production" }],
                "secrets": [
                    { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:wingtechbot/database-url" },
                    { "name": "DISCORD_TOKEN", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:wingtechbot/discord-token" }
                ],
                "logConfiguration": { "logDriver": "awslogs", "options": { "awslogs-group": "/ecs/wingtechbot-backend", "awslogs-region": "us-east-1", "awslogs-stream-prefix": "ecs" } }
            }
        ]
    }
    ```

#### Database on RDS

1. **Create RDS Instance**
    ```bash
    aws rds create-db-instance \
      --db-name wingtechbot \
      --db-instance-identifier wingtechbot-postgres \
      --db-instance-class db.t3.micro \
      --engine postgres \
      --master-username dbadmin \
      --master-user-password your-secure-password \
      --allocated-storage 20
    ```

### Google Cloud Platform

#### Backend on Cloud Run

1. **Build and Push to GCR**

    ```bash
    gcloud builds submit --tag gcr.io/PROJECT_ID/wingtechbot-backend packages/backend
    ```

2. **Deploy to Cloud Run**
    ```bash
    gcloud run deploy wingtechbot-backend \
      --image gcr.io/PROJECT_ID/wingtechbot-backend \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --set-env-vars NODE_ENV=production \
      --set-secrets DATABASE_URL=wingtechbot-db-url:latest \
      --set-secrets DISCORD_TOKEN=discord-token:latest
    ```

### Heroku Deployment

1. **Create Heroku App**

    ```bash
    heroku create wingtechbot-mk3
    ```

2. **Add PostgreSQL**

    ```bash
    heroku addons:create heroku-postgresql:hobby-dev
    ```

3. **Configure Environment Variables**

    ```bash
    heroku config:set NODE_ENV=production
    heroku config:set DISCORD_TOKEN=your_discord_token
    heroku config:set DISCORD_CLIENT_ID=your_client_id
    ```

4. **Deploy**
    ```bash
    git subtree push --prefix packages/backend heroku main
    ```

## 🔐 Environment Variables

### Required Environment Variables

```bash
# Node.js Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Discord Bot
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_test_guild_id (optional, for development)

# API Security
JWT_SECRET=your_jwt_secret_key
API_RATE_LIMIT=100 # requests per 15 minutes

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend-domain.com
```

### Security Best Practices

1. **Use Secrets Management**
    - AWS Secrets Manager
    - Google Secret Manager
    - Azure Key Vault
    - Heroku Config Vars

2. **Environment-Specific Variables**

    ```bash
    # Development
    NODE_ENV=development
    LOG_LEVEL=debug

    # Staging
    NODE_ENV=staging
    LOG_LEVEL=info

    # Production
    NODE_ENV=production
    LOG_LEVEL=warn
    ```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
    push:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: "18"
            - run: npm install -g pnpm
            - run: pnpm install
            - run: pnpm test
            - run: pnpm lint

    deploy-backend:
        needs: test
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3

            - name: Configure AWS credentials
              uses: aws-actions/configure-aws-credentials@v2
              with:
                  aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
                  aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
                  aws-region: us-east-1

            - name: Login to Amazon ECR
              id: login-ecr
              uses: aws-actions/amazon-ecr-login@v1

            - name: Build and push Docker image
              working-directory: packages/backend
              env:
                  ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
                  ECR_REPOSITORY: wingtechbot-backend
                  IMAGE_TAG: ${{ github.sha }}
              run: |
                  docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
                  docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

            - name: Deploy to ECS
              run: |
                  aws ecs update-service \
                    --cluster wingtechbot-cluster \
                    --service wingtechbot-backend \
                    --force-new-deployment

    deploy-frontend:
        needs: test
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: "18"

            - run: npm install -g pnpm
            - run: pnpm install
            - run: pnpm build:frontend

            - name: Deploy to S3
              run: |
                  aws s3 sync packages/frontend/dist/ s3://wingtechbot-frontend/ --delete
                  aws cloudfront create-invalidation --distribution-id E1234567890 --paths "/*"
```

## 🗄️ Database Migration

### Production Migration Strategy

1. **Pre-deployment Checks**

    ```bash
    # Backup database
    pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

    # Test migrations in staging
    pnpm db:migrate
    ```

2. **Zero-downtime Deployment**

    ```bash
    # 1. Deploy backward-compatible schema changes
    pnpm db:migrate

    # 2. Deploy new application code
    docker-compose up -d backend

    # 3. Clean up old schema (if needed)
    # Run cleanup migrations after confirming deployment
    ```

## 📊 Monitoring and Logging

### Health Check Endpoints

The backend provides health check endpoints:

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status
- `GET /metrics` - Prometheus metrics (if enabled)

### Logging Configuration

```typescript
// Production logging configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    transports: [new winston.transports.Console(), new winston.transports.File({ filename: "error.log", level: "error" }), new winston.transports.File({ filename: "combined.log" })],
});
```

### Monitoring Tools

- **Application Performance**: New Relic, DataDog, or Sentry
- **Infrastructure**: CloudWatch, Prometheus + Grafana
- **Discord Bot**: Built-in Discord.js event logging
- **Database**: PostgreSQL slow query logs

## 🔄 Rollback Strategy

### Quick Rollback Steps

1. **Application Rollback**

    ```bash
    # Revert to previous Docker image
    docker-compose down
    docker-compose -f docker-compose.prod.yml up -d
    ```

2. **Database Rollback**

    ```bash
    # Restore from backup (if schema changes)
    psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
    ```

3. **Frontend Rollback**
    ```bash
    # Restore previous S3 deployment
    aws s3 sync s3://wingtechbot-frontend-backup/ s3://wingtechbot-frontend/
    ```

## 📋 Post-Deployment Checklist

- [ ] All services are running and healthy
- [ ] Database migrations completed successfully
- [ ] Discord bot is online and responsive
- [ ] Frontend is accessible and functional
- [ ] API endpoints respond correctly
- [ ] Health checks pass
- [ ] Monitoring alerts are configured
- [ ] SSL certificates are valid
- [ ] Environment variables are set correctly
- [ ] Logs are being collected properly

## 🆘 Troubleshooting

### Common Issues

1. **Discord Bot Offline**
    - Check Discord token validity
    - Verify bot permissions in Discord Developer Portal
    - Check application logs for authentication errors

2. **Database Connection Issues**
    - Verify DATABASE_URL format
    - Check network connectivity
    - Confirm database credentials

3. **Frontend Not Loading**
    - Check static file serving configuration
    - Verify CORS settings if API calls fail
    - Check browser console for errors

4. **High Memory Usage**
    - Monitor for memory leaks
    - Check Discord.js client event handlers
    - Review database connection pooling

For additional help, see the project's GitHub issues or contact the development team.
