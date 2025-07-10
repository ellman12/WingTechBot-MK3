import { Client, type Guild as DiscordGuild, Events, GatewayIntentBits } from 'discord.js';
import type { Kysely } from 'kysely';

import { createGuild, updateGuild } from '../../core/services/GuildService.js';
import type { DB } from '../../generated/database/types.js';
import type { Config } from '../config/Config.js';

export class DiscordBot {
  private readonly client: Client;
  private readonly config: Config;

  public constructor(
    config: Config,
    private readonly db: Kysely<DB>
  ) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, this.onReady.bind(this));
    this.client.on(Events.GuildCreate, this.onGuildJoin.bind(this));
    this.client.on(Events.GuildDelete, this.onGuildLeave.bind(this));
    this.client.on(Events.Error, this.onError.bind(this));
  }

  private onReady(client: Client<true>): void {
    console.log(`🤖 Discord bot ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Bot is in ${client.guilds.cache.size} guilds`);

    // Sync existing guilds on startup
    void this.syncGuilds();
  }

  private async onGuildJoin(guild: DiscordGuild): Promise<void> {
    try {
      console.log(`➕ Bot joined guild: ${guild.name} (${guild.id})`);

      await createGuild(this.db, {
        id: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        prefix: '!',
        isActive: true,
      });

      console.log(`✅ Guild ${guild.name} saved to database`);
    } catch (error) {
      console.error(`❌ Error saving guild ${guild.name}:`, error);
    }
  }

  private async onGuildLeave(guild: DiscordGuild): Promise<void> {
    try {
      console.log(`➖ Bot left guild: ${guild.name} (${guild.id})`);

      await updateGuild(this.db, guild.id, { isActive: false });

      console.log(`✅ Guild ${guild.name} marked as inactive`);
    } catch (error) {
      console.error(`❌ Error updating guild ${guild.name}:`, error);
    }
  }

  private onError(error: Error): void {
    console.error('❌ Discord client error:', error);
  }

  private async syncGuilds(): Promise<void> {
    try {
      console.log('🔄 Syncing guilds with database...');

      const guilds = this.client.guilds.cache;

      for (const [_id, guild] of guilds) {
        try {
          await createGuild(this.db, {
            id: guild.id,
            name: guild.name,
            ownerId: guild.ownerId,
            memberCount: guild.memberCount,
            prefix: '!',
            isActive: true,
          });
        } catch (error) {
          // Guild might already exist, try to update it
          try {
            await updateGuild(this.db, guild.id, {
              name: guild.name,
              memberCount: guild.memberCount,
              isActive: true,
            });
          } catch (updateError) {
            console.error(`❌ Error syncing guild ${guild.name}:`, updateError);
          }
        }
      }

      console.log(`✅ Guild sync completed for ${guilds.size} guilds`);
    } catch (error) {
      console.error('❌ Error syncing guilds:', error);
    }
  }

  public async start(): Promise<void> {
    try {
      console.log('🚀 Starting Discord bot...');
      await this.client.login(this.config.discord.token);
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping Discord bot...');
      this.client.destroy();
      console.log('✅ Discord bot stopped');
    } catch (error) {
      console.error('❌ Error stopping Discord bot:', error);
      throw error;
    }
  }

  public getClient(): Client {
    return this.client;
  }

  public isReady(): boolean {
    return this.client.isReady();
  }
}
