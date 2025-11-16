import type { AutoSoundsRepository } from "@adapters/repositories/AutoSoundsRepository";
import { deployCommands, registerCommands } from "@application/commands/Commands.js";
import { registerAutoReactionEvents } from "@application/eventHandlers/AutoReaction.js";
import { registerAutoSoundsEvents } from "@application/eventHandlers/AutoSounds.js";
import { registerVoiceServiceEventHandlers } from "@application/eventHandlers/DiscordVoiceService.js";
import { registerLlmConversationServiceEventHandlers } from "@application/eventHandlers/LlmConversation.js";
import { registerMessageArchiveEvents } from "@application/eventHandlers/MessageArchive.js";
import { registerReactionArchiveEvents } from "@application/eventHandlers/ReactionArchive.js";
import { registerSoundboardThreadEventHandlers } from "@application/eventHandlers/SoundboardThreadService.js";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { SoundRepository } from "@core/repositories/SoundRepository";
import type { AutoReactionService } from "@core/services/AutoReactionService.js";
import type { AutoSoundsService } from "@core/services/AutoSoundsService.js";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { LlmConversationService } from "@core/services/LlmConversationService";
import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { ReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { SoundTagService } from "@core/services/SoundTagService.js";
import type { SoundboardThreadService } from "@core/services/SoundboardThreadService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { Client, type ClientEvents, Events, GatewayIntentBits, Partials, RESTEvents } from "discord.js";

import type { Config } from "../config/Config.js";

export type DiscordBotDeps = {
    readonly config: Config;
    readonly autoSoundsRepository: AutoSoundsRepository;
    readonly soundRepository: SoundRepository;
    readonly soundService: SoundService;
    readonly soundTagService: SoundTagService;
    readonly reactionRepository: ReactionRepository;
    readonly emoteRepository: ReactionEmoteRepository;
    readonly reactionArchiveService: ReactionArchiveService;
    readonly messageArchiveService: MessageArchiveService;
    readonly discordChatService: DiscordChatService;
    readonly llmConversationService: LlmConversationService;
    readonly soundboardThreadService: SoundboardThreadService;
    readonly autoReactionService: AutoReactionService;
    readonly autoSoundsService: AutoSoundsService;
    readonly voiceService: VoiceService;
    readonly commandChoicesService: CommandChoicesService;
};

export type DiscordBot = {
    readonly client: Client;
    readonly isReady: () => boolean;
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly registerEventHandler: <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>) => void;
};

export const createDiscordBot = async ({
    config,
    autoSoundsRepository,
    soundRepository,
    soundService,
    soundTagService,
    reactionRepository,
    emoteRepository,
    reactionArchiveService,
    messageArchiveService,
    discordChatService,
    llmConversationService,
    soundboardThreadService,
    autoReactionService,
    autoSoundsService,
    voiceService,
    commandChoicesService,
}: DiscordBotDeps): Promise<DiscordBot> => {
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

    const setupEventHandlers = (): void => {
        client.once(Events.ClientReady, async (readyClient: Client<true>) => {
            console.log(`🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
            console.log(`📊 Bot is in ${readyClient.guilds.cache.size} servers`);
            isReadyState = true;

            try {
                await deployCommands(
                    autoSoundsRepository,
                    soundRepository,
                    soundService,
                    soundTagService,
                    voiceService,
                    reactionRepository,
                    emoteRepository,
                    discordChatService,
                    commandChoicesService,
                    config.discord.token,
                    config.discord.clientId,
                    config.discord.serverId
                );
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

        registerCommands(autoSoundsRepository, soundRepository, soundService, soundTagService, voiceService, reactionRepository, emoteRepository, discordChatService, commandChoicesService, registerEventHandler);

        registerReactionArchiveEvents(reactionArchiveService, registerEventHandler);
        registerMessageArchiveEvents(messageArchiveService, registerEventHandler);
        registerLlmConversationServiceEventHandlers(llmConversationService, registerEventHandler);
        registerSoundboardThreadEventHandlers(soundboardThreadService, registerEventHandler);
        registerVoiceServiceEventHandlers(voiceService, registerEventHandler);
        registerAutoReactionEvents(autoReactionService, registerEventHandler);
        registerAutoSoundsEvents(autoSoundsService, registerEventHandler);
    };

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting Discord bot...");

            await client.login(config.discord.token);

            const guild = await client.guilds.fetch(config.discord.serverId!);
            await guild.fetch();
            await emoteRepository.createKarmaEmotes(guild);

            //If first boot, pull in all messages from all time. Otherwise, just get this year's.
            const year = (await messageArchiveService.getAllDBMessages()).length === 0 ? undefined : new Date().getUTCFullYear();
            await messageArchiveService.processAllChannels(guild, year);

            //Remove any messages that were deleted while bot offline.
            await messageArchiveService.removeDeletedMessages(guild, year);

            await soundboardThreadService.findOrCreateSoundboardThread(guild);
        } catch (error) {
            console.error("❌ Failed to start Discord bot:", error);
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
        try {
            console.log("🛑 Stopping Discord bot...");
            await client.destroy();
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
