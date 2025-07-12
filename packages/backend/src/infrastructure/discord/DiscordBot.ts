import { Client, type ClientEvents, Events, GatewayIntentBits } from "discord.js";

import type { Config } from "../config/Config.js";

// Private state using file-level constants
let clientInstance: Client | null = null;
let configInstance: Config | null = null;
let isReady = false;

// Private functions
const createClient = (): Client => {
    return new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
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

export const registerEventHandler = <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>): void => {
    if (!clientInstance) {
        throw new Error("Discord bot not initialized. Call initializeDiscordBot first.");
    }

    clientInstance.on(event, handler);
};
