# API Reference

## Overview

The WingTechBot MK3 API provides a RESTful interface for managing Discord bot functionality, user data, and system operations. The API follows REST principles and uses JSON for data exchange.

## Base URL

```
Development: http://localhost:3000/api/v1
Production: https://yourdomain.com/api/v1
```

## Authentication

Most endpoints require authentication. Include your API key in the request headers:

```http
Authorization: Bearer YOUR_API_KEY
```

## Response Format

All API responses follow a consistent format:

```json
{
    "success": true,
    "data": {
        // Response data
    },
    "message": "Operation completed successfully",
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid input data",
        "details": {
            "field": "username",
            "issue": "Username is required"
        }
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Endpoints

### Health Check

#### GET /health

Check API health status.

**Response:**

```json
{
    "success": true,
    "data": {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "uptime": 3600,
        "version": "1.0.0"
    }
}
```

### Users

#### GET /users

Get all users with pagination.

**Query Parameters:**

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `search` (string, optional): Search by username or Discord ID

**Response:**

```json
{
    "success": true,
    "data": {
        "users": [
            {
                "id": "user123",
                "username": "example_user",
                "discordId": "123456789",
                "createdAt": "2024-01-01T00:00:00.000Z",
                "updatedAt": "2024-01-01T00:00:00.000Z"
            }
        ],
        "pagination": {
            "page": 1,
            "limit": 20,
            "total": 100,
            "pages": 5
        }
    }
}
```

#### GET /users/{id}

Get a specific user by ID.

**Parameters:**

- `id` (string, required): User ID

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "user123",
        "username": "example_user",
        "discordId": "123456789",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

#### POST /users

Create a new user.

**Request Body:**

```json
{
    "username": "new_user",
    "discordId": "987654321"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "user456",
        "username": "new_user",
        "discordId": "987654321",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

#### PUT /users/{id}

Update a user.

**Parameters:**

- `id` (string, required): User ID

**Request Body:**

```json
{
    "username": "updated_username"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "user123",
        "username": "updated_username",
        "discordId": "123456789",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

#### DELETE /users/{id}

Delete a user.

**Parameters:**

- `id` (string, required): User ID

**Response:**

```json
{
    "success": true,
    "message": "User deleted successfully"
}
```

### Guilds (Discord Servers)

#### GET /guilds

Get all guilds with pagination.

**Query Parameters:**

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)

**Response:**

```json
{
    "success": true,
    "data": {
        "guilds": [
            {
                "id": "guild123",
                "name": "Example Server",
                "ownerId": "user123",
                "memberCount": 100,
                "createdAt": "2024-01-01T00:00:00.000Z",
                "updatedAt": "2024-01-01T00:00:00.000Z"
            }
        ],
        "pagination": {
            "page": 1,
            "limit": 20,
            "total": 50,
            "pages": 3
        }
    }
}
```

#### GET /guilds/{id}

Get a specific guild by ID.

**Parameters:**

- `id` (string, required): Guild ID

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "guild123",
        "name": "Example Server",
        "ownerId": "user123",
        "memberCount": 100,
        "channels": [
            {
                "id": "channel123",
                "name": "general",
                "type": "text"
            }
        ],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

### Voice Commands

#### POST /voice/join

Join a voice channel.

**Request Body:**

```json
{
    "guildId": "guild123",
    "channelId": "channel456"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "connected": true,
        "channelId": "channel456",
        "guildId": "guild123"
    }
}
```

#### POST /voice/leave

Leave the current voice channel.

**Request Body:**

```json
{
    "guildId": "guild123"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "connected": false,
        "guildId": "guild123"
    }
}
```

#### POST /voice/play

Play audio from a URL.

**Request Body:**

```json
{
    "guildId": "guild123",
    "url": "https://example.com/audio.mp3"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "playing": true,
        "track": {
            "title": "Example Track",
            "url": "https://example.com/audio.mp3",
            "duration": 180
        }
    }
}
```

#### POST /voice/pause

Pause current audio playback.

**Request Body:**

```json
{
    "guildId": "guild123"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "paused": true
    }
}
```

#### POST /voice/resume

Resume paused audio playback.

**Request Body:**

```json
{
    "guildId": "guild123"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "playing": true
    }
}
```

#### POST /voice/stop

Stop and clear the audio queue.

**Request Body:**

```json
{
    "guildId": "guild123"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "stopped": true,
        "queueCleared": true
    }
}
```

#### GET /voice/queue/{guildId}

Get the current audio queue.

**Parameters:**

- `guildId` (string, required): Guild ID

**Response:**

```json
{
    "success": true,
    "data": {
        "current": {
            "title": "Current Track",
            "url": "https://example.com/current.mp3",
            "duration": 180,
            "position": 45
        },
        "queue": [
            {
                "title": "Next Track",
                "url": "https://example.com/next.mp3",
                "duration": 240
            }
        ],
        "totalTracks": 2
    }
}
```

### Moderation Commands

#### POST /moderation/kick

Kick a user from the server.

**Request Body:**

```json
{
    "guildId": "guild123",
    "userId": "user456",
    "reason": "Violation of server rules"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "kicked": true,
        "userId": "user456",
        "guildId": "guild123",
        "reason": "Violation of server rules"
    }
}
```

#### POST /moderation/ban

Ban a user from the server.

**Request Body:**

```json
{
    "guildId": "guild123",
    "userId": "user456",
    "reason": "Repeated violations",
    "deleteMessageDays": 7
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "banned": true,
        "userId": "user456",
        "guildId": "guild123",
        "reason": "Repeated violations",
        "deleteMessageDays": 7
    }
}
```

#### POST /moderation/timeout

Timeout a user.

**Request Body:**

```json
{
    "guildId": "guild123",
    "userId": "user456",
    "duration": 3600,
    "reason": "Inappropriate behavior"
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "timedOut": true,
        "userId": "user456",
        "guildId": "guild123",
        "duration": 3600,
        "reason": "Inappropriate behavior",
        "expiresAt": "2024-01-01T01:00:00.000Z"
    }
}
```

#### POST /moderation/clear

Clear messages from a channel.

**Request Body:**

```json
{
    "guildId": "guild123",
    "channelId": "channel456",
    "amount": 10
}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "cleared": 10,
        "channelId": "channel456",
        "guildId": "guild123"
    }
}
```

### System Information

#### GET /system/info

Get system information.

**Response:**

```json
{
    "success": true,
    "data": {
        "version": "1.0.0",
        "uptime": 3600,
        "memory": {
            "used": 512,
            "total": 1024,
            "free": 512
        },
        "cpu": {
            "usage": 25.5,
            "cores": 8
        },
        "discord": {
            "connected": true,
            "guilds": 5,
            "users": 1000
        }
    }
}
```

#### GET /system/logs

Get system logs.

**Query Parameters:**

- `level` (string, optional): Log level (error, warn, info, debug)
- `limit` (number, optional): Number of logs (default: 100, max: 1000)
- `since` (string, optional): ISO timestamp to get logs since

**Response:**

```json
{
    "success": true,
    "data": {
        "logs": [
            {
                "timestamp": "2024-01-01T00:00:00.000Z",
                "level": "info",
                "message": "Server started successfully",
                "context": {
                    "service": "api"
                }
            }
        ],
        "total": 100
    }
}
```

## Error Codes

| Code                   | Description                               |
| ---------------------- | ----------------------------------------- |
| `VALIDATION_ERROR`     | Request data validation failed            |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication         |
| `AUTHORIZATION_ERROR`  | Insufficient permissions                  |
| `NOT_FOUND`            | Resource not found                        |
| `CONFLICT`             | Resource conflict (e.g., duplicate entry) |
| `RATE_LIMIT_EXCEEDED`  | Too many requests                         |
| `DISCORD_API_ERROR`    | Discord API error                         |
| `DATABASE_ERROR`       | Database operation failed                 |
| `INTERNAL_ERROR`       | Internal server error                     |

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **General endpoints**: 100 requests per minute
- **Voice commands**: 30 requests per minute
- **Moderation commands**: 10 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Discord Webhook Events

The API can send webhook notifications for various events:

#### User Joined

```json
{
    "event": "user.joined",
    "data": {
        "userId": "user123",
        "guildId": "guild123",
        "timestamp": "2024-01-01T00:00:00.000Z"
    }
}
```

#### Voice State Changed

```json
{
    "event": "voice.state_changed",
    "data": {
        "userId": "user123",
        "guildId": "guild123",
        "oldChannelId": "channel123",
        "newChannelId": "channel456",
        "timestamp": "2024-01-01T00:00:00.000Z"
    }
}
```

### Webhook Configuration

To receive webhooks, configure your endpoint:

```json
{
    "url": "https://yourdomain.com/webhooks",
    "events": ["user.joined", "voice.state_changed"],
    "secret": "your_webhook_secret"
}
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @wingtechbot/api-client
```

```typescript
import { WingTechBotAPI } from "@wingtechbot/api-client";

const api = new WingTechBotAPI({
    baseURL: "http://localhost:3000/api/v1",
    apiKey: "your_api_key",
});

// Get users
const users = await api.users.list({ page: 1, limit: 20 });

// Create user
const user = await api.users.create({
    username: "new_user",
    discordId: "123456789",
});
```

### Python

```bash
pip install wingtechbot-api
```

```python
from wingtechbot_api import WingTechBotAPI

api = WingTechBotAPI(
    base_url="http://localhost:3000/api/v1",
    api_key="your_api_key"
)

# Get users
users = api.users.list(page=1, limit=20)

# Create user
user = api.users.create(
    username="new_user",
    discord_id="123456789"
)
```

## Testing

### Interactive API Documentation

Visit `/api/docs` for interactive API documentation with Swagger UI.

### Postman Collection

Download the Postman collection for testing:

```bash
curl -o wingtechbot-api.postman_collection.json \
  https://api.wingtechbot.com/postman-collection
```

### Example Requests

```bash
# Health check
curl -X GET http://localhost:3000/api/v1/health

# Get users
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_API_KEY"

# Create user
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"username": "test_user", "discordId": "123456789"}'
```

## Support

For API support:

1. Check the [error codes](#error-codes) section
2. Review the [troubleshooting guide](/guide/development#troubleshooting)
3. Check the [GitHub issues](https://github.com/ellman12/WingTechBot-MK3/issues)
4. Contact the development team

For real-time API status, visit the [status page](https://status.wingtechbot.com).
