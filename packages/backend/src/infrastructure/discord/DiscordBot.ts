import { Client, type ClientEvents, Events, GatewayIntentBits } from "discord.js";

import { createDiscordVoiceAdapter } from "@/adapters/services/DiscordVoiceAdapter.js";
import { deployCommands, registerCommands } from "@/application/commands/commands.js";

import type { Config } from "../config/Config.js";

export type DiscordBotDeps = {
    readonly config: Config;
};

export type DiscordBot = {
    readonly client: Client;
    readonly isReady: () => boolean;
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly registerEventHandler: <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>) => void;
};

export const createDiscordBot = (deps: DiscordBotDeps): DiscordBot => {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildVoiceStates],
    });

    let isReadyState = false;

    const voiceService = createDiscordVoiceAdapter({ client });

    const setupEventHandlers = (): void => {
        client.once(Events.ClientReady, async (readyClient: Client<true>) => {
            console.log(`🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
            console.log(`📊 Bot is in ${readyClient.guilds.cache.size} servers`);
            isReadyState = true;

            if (process.env.NODE_ENV === "development") {
                try {
                    await deployCommands(deps.config.discord.token, deps.config.discord.clientId, deps.config.discord.serverId, voiceService);
                } catch (error) {
                    console.warn("⚠️ Failed to deploy commands automatically:", error);
                    console.log("💡 You can deploy commands manually with: pnpm discord:deploy-commands");
                }
            }
        });

        client.on(Events.Error, (error: Error) => {
            console.error("❌ Discord client error:", error);
        });

        registerCommands(voiceService, {
            client,
            isReady,
            start,
            stop,
            registerEventHandler,
        });
    };

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting Discord bot...");
            await client.login(deps.config.discord.token);
        } catch (error) {
            console.error("❌ Failed to start Discord bot:", error);
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
        try {
            console.log("🛑 Stopping Discord bot...");
            client.destroy();
            isReadyState = false;
            console.log("✅ Discord bot stopped");
        } catch (error) {
            console.error("❌ Error stopping Discord bot:", error);
            throw error;
        }
    };

    const registerEventHandler = <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>): void => {
        client.on(event, handler);
    };

    const isReady = (): boolean => isReadyState;

    setupEventHandlers();

    return {
        client,
        isReady,
        start,
        stop,
        registerEventHandler,
    };
};
