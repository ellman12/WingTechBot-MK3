import { Client, Events, GatewayIntentBits } from "discord.js";
<<<<<<< HEAD
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
=======

import type { Config } from "../config/Config.js";

// Private state using file-level constants
let clientInstance: Client | null = null;
let configInstance: Config | null = null;
let isReady = false;

// Private functions
const createClient = (): Client => {
    return new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
};

const setupEventHandlers = (client: Client): void => {
    client.once(Events.ClientReady, (readyClient: Client<true>) => {
        console.log(`🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
        console.log(`📊 Bot is in ${readyClient.guilds.cache.size} guilds`);
        isReady = true;
    });

    client.on(Events.Error, (error: Error) => {
        console.error("❌ Discord client error:", error);
    });
};

// Public interface - exported functions
export const initializeDiscordBot = (config: Config): void => {
    configInstance = config;

    if (!clientInstance) {
        clientInstance = createClient();
        setupEventHandlers(clientInstance);
    }
};

export const startDiscordBot = async (): Promise<void> => {
    if (!clientInstance || !configInstance) {
        throw new Error("Discord bot not initialized. Call initializeDiscordBot first.");
    }

    try {
        console.log("🚀 Starting Discord bot...");
        await clientInstance.login(configInstance.discord.token);
    } catch (error) {
        console.error("❌ Failed to start Discord bot:", error);
        throw error;
    }
};

export const stopDiscordBot = async (): Promise<void> => {
    if (!clientInstance) {
        return;
    }

    try {
        console.log("🛑 Stopping Discord bot...");
        clientInstance.destroy();
        isReady = false;
        console.log("✅ Discord bot stopped");
    } catch (error) {
        console.error("❌ Error stopping Discord bot:", error);
        throw error;
    }
};

export const getDiscordClient = (): Client | null => {
    return clientInstance;
};

export const isDiscordBotReady = (): boolean => {
    return isReady;
};

export const getDiscordConfig = (): Config | null => {
    return configInstance;
};
>>>>>>> 6361f2d (Cleanup pt1)
