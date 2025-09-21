import { createDiscordVoiceService } from "@adapters/services/DiscordVoiceService.js";
import { deployCommands, registerCommands } from "@application/commands/Commands.js";
import { registerReactionEvents } from "@application/eventHandlers/Reactions";
import type { ReactionService } from "@core/services/ReactionService";
import type { SoundService } from "@core/services/SoundService";
import { Client, type ClientEvents, Events, GatewayIntentBits, Partials } from "discord.js";

import type { Config } from "../config/Config.js";

export type DiscordBotDeps = {
    readonly config: Config;
    readonly soundService: SoundService;
    readonly reactionService: ReactionService;
};

export type DiscordBot = {
    readonly client: Client;
    readonly isReady: () => boolean;
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly registerEventHandler: <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>) => void;
};

export const createDiscordBot = ({ config, soundService, reactionService }: DiscordBotDeps): DiscordBot => {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessageReactions,
        ],
        partials: [Partials.User, Partials.GuildMember, Partials.ThreadMember, Partials.Channel, Partials.Message, Partials.Reaction],
    });

    let isReadyState = false;

    const voiceService = createDiscordVoiceService({ client, soundService });

    const setupEventHandlers = (): void => {
        client.once(Events.ClientReady, async (readyClient: Client<true>) => {
            console.log(`🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
            console.log(`📊 Bot is in ${readyClient.guilds.cache.size} servers`);
            isReadyState = true;

            try {
                await deployCommands(soundService, voiceService, config.discord.token, config.discord.clientId, config.discord.serverId);
            } catch (error) {
                console.warn("⚠️ Failed to deploy commands automatically:", error);
                console.log("💡 You can deploy commands manually with: pnpm discord:deploy-commands");
            }
        });

        client.on(Events.Error, (error: Error) => {
            console.error("❌ Discord client error:", error);
        });

        client.on(RESTEvents.RateLimited, rateLimitData => {
            console.warn("⚠️ Rate limited:");
            console.log(`Route: ${rateLimitData.route}`);
            console.log(`Method: ${rateLimitData.method}`);
            console.log(`Retry after: ${rateLimitData.retryAfter}ms`);
            console.log(`Global: ${rateLimitData.global}`);
        });

        registerCommands(soundService, voiceService, registerEventHandler);

        registerReactionEvents(reactionService, registerEventHandler);
    };

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting Discord bot...");
            await client.login(config.discord.token);
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
