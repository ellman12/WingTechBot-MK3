import { Client, Events, GatewayIntentBits } from "discord.js";
import type { Kysely } from "kysely";

import type { DB } from "@/generated/database/types";

import type { Config } from "../config/Config.js";

export class DiscordBot {
    private readonly client: Client;
    private readonly config: Config;

    public constructor(
        config: Config,
        private readonly db: Kysely<DB>
    ) {
        this.config = config;
        this.client = new Client({ intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildVoiceStates] });

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.client.once(Events.ClientReady, this.onReady.bind(this));
        this.client.on(Events.Error, this.onError.bind(this));
    }

    private onReady(client: Client<true>): void {
        console.log(`🤖 Discord bot ready! Logged in as ${client.user.tag}`);
        console.log(`📊 Bot is in ${client.guilds.cache.size} guilds`);
    }

    private onError(error: Error): void {
        console.error("❌ Discord client error:", error);
    }

    public async start(): Promise<void> {
        try {
            console.log("🚀 Starting Discord bot...");
            await this.client.login(this.config.discord.token);
        } catch (error) {
            console.error("❌ Failed to start Discord bot:", error);
            throw error;
        }
    }

    public async stop(): Promise<void> {
        try {
            console.log("🛑 Stopping Discord bot...");
            await this.client.destroy();
            console.log("✅ Discord bot stopped");
        } catch (error) {
            console.error("❌ Error stopping Discord bot:", error);
            throw error;
        }
    }
}
