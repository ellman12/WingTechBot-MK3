#!/usr/bin/env bash
# Generates the Docker compose YAML file needed for running on the prod server.
set -e

GIT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "no-tag")
GIT_COMMIT=$(git rev-parse --short HEAD)

REGISTRY=${REGISTRY,,}
IMAGE_NAME=${IMAGE_NAME,,}

if [[ "$IMAGE_NAME" =~ [A-Z] ]]; then
  echo "ERROR: IMAGE_NAME must be lowercase for GHCR"
  exit 1
fi

cat > compose.yaml << EOF
services:
  backend:
    image: ${REGISTRY}/${IMAGE_NAME}/backend:latest
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://wingtechbot:wingtechbot_password@postgres:5432/wingtechbot
      - SOUNDS_STORAGE_PATH=/app/sounds
      - AUDIO_CACHE_PATH=/app/sounds/wtb-audio-cache
      - GIT_COMMIT=${GIT_COMMIT}
      - GIT_TAG=${GIT_TAG}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - sounds-data:/app/sounds
      - ./llmInstructions/:/app/packages/backend/llmInstructions:ro
    networks:
      - app-network
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=wingtechbot
      - POSTGRES_USER=wingtechbot
      - POSTGRES_PASSWORD=wingtechbot_password
      - POSTGRES_HOST_AUTH_METHOD=md5
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wingtechbot -d wingtechbot"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backup:
    image: ${REGISTRY}/${IMAGE_NAME}/backup:latest
    env_file:
      - .env
    environment:
      - DATABASE_NAME=wingtechbot
      - DATABASE_HOST=postgres
      - DATABASE_USER=wingtechbot
      - PGPASSWORD=wingtechbot_password
      - BACKUP_RETENTION_DAYS=7
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - wtb_backups:/backups
    networks:
      - app-network
    restart: unless-stopped

  watchtower:
    image: nickfedor/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_POLL_INTERVAL=300
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_REGISTRY_AUTH=true
      - DOCKER_USERNAME=\${GHCR_USERNAME}
      - DOCKER_PASSWORD=\${GHCR_TOKEN}
    restart: unless-stopped

volumes:
  postgres_data:
  sounds-data:
  wtb_backups:

networks:
  app-network:
    driver: bridge
EOF