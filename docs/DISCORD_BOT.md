# Discord Bot Guide

This guide covers setting up and working with the WingTechBot MK3 Discord bot.

## 🤖 Bot Overview

WingTechBot MK3 is a modern Discord bot built with Discord.js v14, featuring:

- Automatic guild management and syncing
- Event-driven architecture
- Database integration for persistent data
- Robust error handling and logging
- Modular command system

## 🚀 Quick Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give your application a name (e.g., "WingTechBot MK3")
4. Go to the "Bot" section
5. Click "Add Bot"
6. Copy the bot token (keep this secret!)

### 2. Configure Bot Permissions

In the "Bot" section:

- **Public Bot**: Disable (unless you want others to add your bot)
- **Requires OAuth2 Code Grant**: Disable
- **Bot Permissions**: Select the permissions your bot needs

**Recommended Permissions:**

- Send Messages
- Read Message History
- Use Slash Commands
- Manage Messages (if moderation features)
- Connect (for voice features)
- Speak (for voice features)

### 3. Environment Configuration

Create/update your `.env` file:

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id
DISCORD_GUILD_ID=your_test_guild_id (optional, for development)

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/wingtechbot

# Other settings
NODE_ENV=development
LOG_LEVEL=debug
```

### 4. Invite Bot to Server

1. Go to "OAuth2" > "URL Generator" in Developer Portal
2. Select "bot" scope
3. Select the permissions you configured
4. Copy the generated URL and open in browser
5. Select your server and authorize

## 🏗️ Bot Architecture

### Event System

The bot uses Discord.js event handling:

```typescript
// Event handler setup
private setupEventHandlers(): void {
  this.client.once(Events.ClientReady, this.onReady.bind(this));
  this.client.on(Events.GuildCreate, this.onGuildJoin.bind(this));
  this.client.on(Events.GuildDelete, this.onGuildLeave.bind(this));
  this.client.on(Events.MessageCreate, this.onMessage.bind(this));
  this.client.on(Events.InteractionCreate, this.onInteraction.bind(this));
  this.client.on(Events.Error, this.onError.bind(this));
}
```

### Core Events

#### Bot Ready

```typescript
private onReady(client: Client<true>): void {
  console.log(`🤖 Discord bot ready! Logged in as ${client.user.tag}`);
  console.log(`📊 Bot is in ${client.guilds.cache.size} guilds`);

  // Sync existing guilds with database
  void this.syncGuilds();
}
```

#### Guild Join/Leave

```typescript
private async onGuildJoin(guild: DiscordGuild): Promise<void> {
  try {
    await createGuild(this.db, {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
    });
    console.log(`✅ Guild ${guild.name} saved to database`);
  } catch (error) {
    console.error(`❌ Error saving guild ${guild.name}:`, error);
  }
}
```

## 🎮 Command System

### Slash Commands

Create slash commands for modern Discord interactions:

```typescript
// Command definition
const pingCommand = {
  name: 'ping',
  description: 'Replies with Pong!',
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply('Pong!');
  },
};

// Register commands
const commands = [pingCommand];

// In your bot initialization
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

try {
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
  console.log('✅ Slash commands registered');
} catch (error) {
  console.error('❌ Error registering commands:', error);
}
```

### Command Handler

```typescript
private async onInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = this.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    const errorMessage = 'There was an error executing this command!';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
```

## 🗄️ Database Integration

### Guild Management

The bot automatically syncs Discord guild data with the database:

```typescript
// Guild service functions
export async function createGuild(db: Kysely<DB>, guildData: CreateGuildData): Promise<Guild> {
  return await db
    .insertInto('guilds')
    .values({
      id: guildData.id,
      name: guildData.name,
      ownerId: guildData.ownerId,
      memberCount: guildData.memberCount,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateGuild(
  db: Kysely<DB>,
  guildId: string,
  updateData: UpdateGuildData
): Promise<Guild> {
  return await db
    .updateTable('guilds')
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where('id', '=', guildId)
    .returningAll()
    .executeTakeFirstOrThrow();
}
```

## 🔧 Development Workflow

### Starting the Bot

```bash
# Development mode (with auto-restart)
pnpm dev

# Production mode
pnpm start

# Bot only (without API server)
pnpm dev:bot
```

### Testing Commands

1. **Invite bot to test server**
2. **Use slash commands**: Type `/` in Discord to see available commands
3. **Check logs**: Monitor console output for errors
4. **Database verification**: Check that guild data is synced

### Debugging

Enable debug logging:

```typescript
// In your bot configuration
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Enable debug logging
  rest: { version: '10' },
});

// Log all events in development
if (process.env.NODE_ENV === 'development') {
  client.on('debug', console.log);
}
```

## 🎯 Common Use Cases

### Message Commands (Legacy)

```typescript
private async onMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore messages without prefix
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  switch (command) {
    case 'ping':
      await message.reply('Pong!');
      break;
    case 'server':
      await message.reply(`Server name: ${message.guild?.name}\nTotal members: ${message.guild?.memberCount}`);
      break;
  }
}
```

### User Management

```typescript
// Track user joins
client.on(Events.GuildMemberAdd, async member => {
  console.log(`👋 ${member.user.tag} joined ${member.guild.name}`);

  // Save user to database
  await createUser(db, {
    id: member.id,
    username: member.user.username,
    discriminator: member.user.discriminator,
    avatarUrl: member.user.displayAvatarURL(),
  });

  // Send welcome message
  const channel = member.guild.systemChannel;
  if (channel) {
    await channel.send(`Welcome to the server, ${member}!`);
  }
});
```

### Moderation Features

```typescript
// Auto-moderation example
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  // Check for spam or inappropriate content
  const bannedWords = ['spam', 'inappropriate'];
  const hasViolation = bannedWords.some(word => message.content.toLowerCase().includes(word));

  if (hasViolation) {
    await message.delete();
    await message.author.send('Your message was removed for violating server rules.');

    // Log the incident
    console.log(`🚨 Message removed from ${message.author.tag}: ${message.content}`);
  }
});
```

## 🔒 Security Best Practices

### Token Security

- **Never commit tokens to version control**
- **Use environment variables**
- **Rotate tokens regularly**
- **Use different tokens for development and production**

### Permission Management

```typescript
// Check permissions before executing commands
if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
  await interaction.reply({
    content: 'You need the "Manage Messages" permission to use this command.',
    ephemeral: true
  });
  return;
}
```

### Rate Limiting

```typescript
// Simple rate limiting
const userCooldowns = new Map();

const executeCommand = async (interaction: ChatInputCommandInteraction) => {
  const userId = interaction.user.id;
  const now = Date.now();
  const cooldownAmount = 5000; // 5 seconds

  if (userCooldowns.has(userId)) {
    const expirationTime = userCooldowns.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      await interaction.reply({
        content: `Please wait ${timeLeft.toFixed(1)} seconds before using this command again.`,
        ephemeral: true,
      });
      return;
    }
  }

  userCooldowns.set(userId, now);
  // Execute command...
};
```

## 📊 Monitoring & Logging

### Structured Logging

```typescript
interface BotLogContext {
  event: string;
  guildId?: string;
  userId?: string;
  commandName?: string;
  error?: string;
}

const logBotEvent = (message: string, context: BotLogContext) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'discord-bot',
      message,
      ...context,
    })
  );
};

// Usage
logBotEvent('Command executed', {
  event: 'command_executed',
  guildId: interaction.guildId,
  userId: interaction.user.id,
  commandName: interaction.commandName,
});
```

### Health Monitoring

```typescript
export class BotHealthChecker {
  constructor(private client: Client) {}

  isHealthy(): boolean {
    return (
      this.client.isReady() &&
      this.client.ws.status === 0 && // READY
      this.client.guilds.cache.size > 0
    );
  }

  getStatus() {
    return {
      ready: this.client.isReady(),
      wsStatus: this.client.ws.status,
      guilds: this.client.guilds.cache.size,
      ping: this.client.ws.ping,
      uptime: this.client.uptime,
    };
  }
}
```

## 🚨 Error Handling

### Graceful Error Handling

```typescript
// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  // Graceful shutdown
  process.exit(1);
});

// Discord client error handling
client.on(Events.Error, error => {
  console.error('Discord client error:', error);
});

client.on(Events.Warn, warning => {
  console.warn('Discord client warning:', warning);
});
```

### Reconnection Logic

```typescript
client.on(Events.ShardDisconnect, (event, shardId) => {
  console.log(`🔌 Shard ${shardId} disconnected:`, event);
});

client.on(Events.ShardReconnecting, shardId => {
  console.log(`🔄 Shard ${shardId} reconnecting...`);
});

client.on(Events.ShardReady, shardId => {
  console.log(`✅ Shard ${shardId} ready!`);
});
```

## 🧪 Testing the Bot

### Local Testing

1. **Create a test Discord server**
2. **Invite your bot with minimal permissions**
3. **Test commands incrementally**
4. **Monitor logs for errors**

### Integration Tests

```typescript
// Mock Discord interactions for testing
describe('Discord Bot Commands', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>;

  beforeEach(() => {
    mockInteraction = {
      commandName: 'ping',
      reply: jest.fn(),
      user: { id: '123', tag: 'TestUser#1234' },
      guildId: '456',
    };
  });

  it('should respond to ping command', async () => {
    await pingCommand.execute(mockInteraction as ChatInputCommandInteraction);
    expect(mockInteraction.reply).toHaveBeenCalledWith('Pong!');
  });
});
```

## 📚 Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/docs/)
- [Discord API Reference](https://discord.com/developers/docs/reference)
- [Bot Best Practices](https://discord.com/developers/docs/topics/community-resources#libraries)

For troubleshooting and support, check the project's GitHub issues or Discord community.
