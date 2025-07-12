# API Documentation

This document provides comprehensive documentation for the WingTechBot MK3 REST API.

## 🌐 Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.wingtechbot.com`

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "discordId": "123456789012345678",
  "token": "discord-oauth-token"
}
```

## 📊 API Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🏛️ Guild Endpoints

### Get All Guilds

```http
GET /api/guilds
Authorization: Bearer <token>
```

**Response:**

```json
{ "success": true, "data": [{ "id": "123456789012345678", "name": "My Discord Server", "ownerId": "987654321098765432", "memberCount": 150, "isActive": true, "createdAt": "2024-01-01T00:00:00.000Z", "updatedAt": "2024-01-01T00:00:00.000Z" }] }
```

### Get Guild by ID

```http
GET /api/guilds/:id
Authorization: Bearer <token>
```

**Parameters:**

- `id` (string) - Guild ID

**Response:**

```json
{ "success": true, "data": { "id": "123456789012345678", "name": "My Discord Server", "ownerId": "987654321098765432", "memberCount": 150, "isActive": true, "createdAt": "2024-01-01T00:00:00.000Z", "updatedAt": "2024-01-01T00:00:00.000Z" } }
```

### Create Guild

```http
POST /api/guilds
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "123456789012345678",
  "name": "My Discord Server",
  "ownerId": "987654321098765432",
  "memberCount": 150
}
```

**Response:**

```json
{ "success": true, "data": { "id": "123456789012345678", "name": "My Discord Server", "ownerId": "987654321098765432", "memberCount": 150, "isActive": true, "createdAt": "2024-01-01T00:00:00.000Z", "updatedAt": "2024-01-01T00:00:00.000Z" } }
```

### Update Guild

```http
PUT /api/guilds/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Server Name",
  "memberCount": 175
}
```

### Delete Guild

```http
DELETE /api/guilds/:id
Authorization: Bearer <token>
```

## 👥 User Endpoints

### Get All Users

```http
GET /api/users
Authorization: Bearer <token>
```

### Get User by ID

```http
GET /api/users/:id
Authorization: Bearer <token>
```

### Update User

```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "NewUsername",
  "avatarUrl": "https://cdn.discordapp.com/avatars/..."
}
```

## 🔍 Health Check Endpoints

### Basic Health Check

```http
GET /health
```

**Response:**

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

### Detailed Health Check

```http
GET /health/detailed
Authorization: Bearer <token>
```

**Response:**

```json
{
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "services": { "database": { "status": "ok", "responseTime": "5ms" }, "discord": { "status": "ok", "connected": true, "guilds": 15 } },
    "system": { "uptime": "24h 30m 15s", "memory": { "used": "125MB", "total": "512MB" } }
}
```

## 📈 Metrics Endpoint

### Prometheus Metrics

```http
GET /metrics
```

Returns Prometheus-formatted metrics for monitoring.

## ❌ Error Codes

| Code               | Description                       |
| ------------------ | --------------------------------- |
| `VALIDATION_ERROR` | Request data validation failed    |
| `NOT_FOUND`        | Resource not found                |
| `UNAUTHORIZED`     | Invalid or missing authentication |
| `FORBIDDEN`        | Insufficient permissions          |
| `RATE_LIMITED`     | Too many requests                 |
| `INTERNAL_ERROR`   | Server error                      |
| `DISCORD_ERROR`    | Discord API error                 |
| `DATABASE_ERROR`   | Database operation failed         |

## 🚦 Rate Limiting

- **Rate Limit**: 100 requests per 15 minutes per IP
- **Headers**:
    - `X-RateLimit-Limit`: Total requests allowed
    - `X-RateLimit-Remaining`: Requests remaining
    - `X-RateLimit-Reset`: Time when limit resets

## 📖 OpenAPI Documentation

Interactive API documentation is available at:

- **Development**: `http://localhost:3000/api/docs`
- **Production**: `https://api.wingtechbot.com/api/docs`

## 🧪 Testing the API

### Using cURL

```bash
# Get all guilds
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/guilds

# Create a guild
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"id":"123","name":"Test Guild","ownerId":"456"}' \
     http://localhost:3000/api/guilds
```

### Using JavaScript/Fetch

```javascript
// API client helper
class ApiClient {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...options.headers } });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "API request failed");
        }

        return data;
    }

    // Guild methods
    async getGuilds() {
        return this.request("/api/guilds");
    }

    async getGuild(id) {
        return this.request(`/api/guilds/${id}`);
    }

    async createGuild(guildData) {
        return this.request("/api/guilds", { method: "POST", body: JSON.stringify(guildData) });
    }

    async updateGuild(id, updateData) {
        return this.request(`/api/guilds/${id}`, { method: "PUT", body: JSON.stringify(updateData) });
    }

    async deleteGuild(id) {
        return this.request(`/api/guilds/${id}`, { method: "DELETE" });
    }
}

// Usage
const api = new ApiClient("http://localhost:3000", "your-jwt-token");

try {
    const guilds = await api.getGuilds();
    console.log("Guilds:", guilds.data);
} catch (error) {
    console.error("API Error:", error.message);
}
```

## 🔄 Pagination

For endpoints that return lists, pagination is available:

```http
GET /api/guilds?page=1&limit=10&sort=name&order=asc
```

**Parameters:**

- `page` (number, default: 1) - Page number
- `limit` (number, default: 20, max: 100) - Items per page
- `sort` (string) - Field to sort by
- `order` (string) - `asc` or `desc`

**Response:**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🔍 Filtering

Many endpoints support filtering:

```http
GET /api/guilds?isActive=true&memberCount[gte]=100
```

**Operators:**

- `eq` - Equals
- `ne` - Not equals
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `in` - In array
- `contains` - String contains

## 🎯 Best Practices

### Error Handling

```javascript
async function handleApiCall() {
    try {
        const response = await api.getGuilds();
        return response.data;
    } catch (error) {
        if (error.code === "RATE_LIMITED") {
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 60000));
            return handleApiCall();
        }
        throw error;
    }
}
```

### Caching

- Cache GET requests when appropriate
- Use ETags for conditional requests
- Respect cache-control headers

### Retries

- Implement exponential backoff for retries
- Don't retry on 4xx errors (except 429)
- Limit retry attempts

For more examples and detailed documentation, see the interactive docs at `/api/docs`.
