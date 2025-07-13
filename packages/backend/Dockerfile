# Use Node.js 20 Alpine as base image for smaller size
FROM node:20-alpine AS base

# Install system dependencies for native modules including opus
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    opus-dev \
    libsodium-dev \
    ffmpeg \
    ffmpeg-dev \
    ca-certificates \
    bind-tools

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Set environment variables for native module compilation
ENV NODE_ENV=production
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3
ENV OPUS_LIBRARY_PATH=/usr/lib/libopus.so.0

# Copy package files from monorepo root
COPY package*.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/types/package.json ./packages/types/

# Install dependencies (allow scripts for native modules)
RUN pnpm install --frozen-lockfile
 
# Development stage
FROM base AS development

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start in development mode
CMD ["pnpm", "--filter", "backend", "run", "dev"]

# Build stage
FROM base AS build

# Copy source code
COPY . .

# Build the application
RUN pnpm --filter backend run build

# Install tsc-alias globally to fix path mappings
RUN npm install -g tsc-alias

# Fix path aliases in the compiled output
RUN tsc-alias -p /app/packages/backend/tsconfig.json

# Verify the build output
RUN ls -la /app/packages/backend/dist/

# Production stage
FROM node:20-alpine AS production

# Install system dependencies for production including opus runtime
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    opus \
    libsodium \
    ffmpeg \
    ca-certificates \
    bind-tools

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy everything from build stage (includes all dependencies)
COPY --from=build --chown=nodejs:nodejs /app ./

# Set environment variables
ENV NODE_ENV=production

# Rebuild native modules for the production environment
RUN pnpm rebuild

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["pnpm", "--filter", "backend", "start"] 