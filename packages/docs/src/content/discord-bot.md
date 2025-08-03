# Discord Bot Guide

## Overview

The WingTechBot MK3 Discord bot provides voice channel management, moderation tools, and custom commands.

## Bot Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your application (e.g., "WingTechBot MK3")
4. Go to "Bot" section and create a bot

### 2. Configure Bot Permissions

Required permissions:

\`\`\`

- Send Messages
- Use Slash Commands
- Connect to Voice Channels
- Speak in Voice Channels
- Manage Messages
- Read Message History
  \`\`\`

### 3. Add Bot to Server

1. Go to "OAuth2" > "URL Generator"
2. Select "bot" scope
3. Select required permissions
4. Use generated URL to add bot to your server

## Slash Commands

### Voice Commands

\`\`\`
/join - Join voice channel
/leave - Leave voice channel
/play <url> - Play audio from URL
/pause - Pause current audio
/resume - Resume paused audio
/stop - Stop and clear queue
/skip - Skip current track
/queue - Show current queue
\`\`\`

### Moderation Commands

\`\`\`
/kick <user> [reason] - Kick user from server
/ban <user> [reason] - Ban user from server
/timeout <user> <duration> [reason] - Timeout user
/clear <amount> - Clear messages
\`\`\`

### Utility Commands

\`\`\`
/ping - Check bot latency
/info - Show server information
/userinfo <user> - Show user information
/help - Show command help
\`\`\`

## Adding Custom Commands

### Command Structure

\`\`\`typescript
import { SlashCommandBuilder } from 'discord.js'

const customCommand = {
data: new SlashCommandBuilder()
.setName('custom')
.setDescription('Custom command description')
.addStringOption(option =>
option.setName('input')
.setDescription('Input description')
.setRequired(true)
),

execute: async (interaction) => {
const input = interaction.options.getString('input')
await interaction.reply(\`You said: \${input}\`)
}
}
\`\`\`

### Registering Commands

\`\`\`bash

# Deploy commands to Discord

pnpm discord:deploy-commands
\`\`\`

## Event Handling

### Common Events

\`\`\`typescript
// Ready event
client.on('ready', () => {
console.log(\`Logged in as \${client.user?.tag}\`)
})

// Message event
client.on('messageCreate', async (message) => {
if (message.author.bot) return

// Handle message
})

// Voice state update
client.on('voiceStateUpdate', async (oldState, newState) => {
// Handle voice channel changes
})
\`\`\`

## Voice Features

### Audio Playback

\`\`\`typescript
import { createAudioPlayer, createAudioResource } from '@discordjs/voice'

const player = createAudioPlayer()
const resource = createAudioResource('audio.mp3')

player.play(resource)
connection.subscribe(player)
\`\`\`

### Queue Management

\`\`\`typescript
class MusicQueue {
private queue: AudioResource[] = []

add(track: AudioResource) {
this.queue.push(track)
}

next(): AudioResource | undefined {
return this.queue.shift()
}
}
\`\`\`

## Error Handling

### Best Practices

1. **Always handle promise rejections**
2. **Use try-catch blocks for async operations**
3. **Log errors for debugging**
4. **Provide user-friendly error messages**

\`\`\`typescript
try {
await interaction.reply('Command executed successfully')
} catch (error) {
console.error('Command error:', error)
await interaction.reply({
content: 'An error occurred while executing this command.',
ephemeral: true
})
}
\`\`\`

## Deployment

### Environment Variables

\`\`\`env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
\`\`\`

### Production Considerations

- Use process managers (PM2, systemd)
- Implement health checks
- Monitor bot performance
- Set up logging and alerts

For more details, see the [Development Guide](/guide/development) and [Deployment Guide](/guide/deployment).
