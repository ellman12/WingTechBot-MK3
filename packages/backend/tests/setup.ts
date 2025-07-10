import { afterAll, beforeAll } from 'vitest';

// Set up test environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL =
    'postgresql://wingtechbot:wingtechbot_password@localhost:5432/wingtechbot_test';
  process.env.DISCORD_TOKEN = 'test_token';
  process.env.DISCORD_CLIENT_ID = 'test_client_id';
  process.env.PORT = '3001';
});

// Clean up after all tests
afterAll(() => {
  // Clean up test database or other resources if needed
});
