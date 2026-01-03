import type { VoiceEventSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import { deployCommands, registerCommands } from "@application/commands/Commands.js";
import { registerAutoReactionEvents } from "@application/eventHandlers/AutoReaction.js";
import { registerVoiceServiceEventHandlers } from "@application/eventHandlers/DiscordVoiceService.js";
import { registerLlmConversationServiceEventHandlers } from "@application/eventHandlers/LlmConversation.js";
import { registerMessageArchiveEvents } from "@application/eventHandlers/MessageArchive.js";
import { registerReactionArchiveEvents } from "@application/eventHandlers/ReactionArchive.js";
import { registerSoundboardThreadEventHandlers } from "@application/eventHandlers/SoundboardThreadService.js";
import { registerVoiceEventSoundsEventHandlers } from "@application/eventHandlers/VoiceEventSounds.js";
import type { Config } from "@core/config/Config.js";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { AutoReactionService } from "@core/services/AutoReactionService.js";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { LlmConversationService } from "@core/services/LlmConversationService.js";
import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { ReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { SoundTagService } from "@core/services/SoundTagService.js";
import type { SoundboardThreadService } from "@core/services/SoundboardThreadService.js";
import type { VoiceEventSoundsService } from "@core/services/VoiceEventSoundsService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { sleep } from "@core/utils/timeUtils.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import { Client, type ClientEvents, Events, GatewayIntentBits, Partials, PresenceUpdateStatus, RESTEvents, type TextChannel } from "discord.js";

export type EventFilter = <K extends keyof ClientEvents>(event: K, args: ClientEvents[K]) => boolean;

export type DiscordBotDeps = {
    readonly config: Config;
    readonly voiceEventSoundsRepository: VoiceEventSoundsRepository;
    readonly soundRepository: SoundRepository;
    readonly soundService: SoundService;
    readonly soundTagService: SoundTagService;
    readonly reactionRepository: ReactionRepository;
    readonly emoteRepository: ReactionEmoteRepository;
    readonly reactionArchiveService: ReactionArchiveService;
    readonly messageArchiveService: MessageArchiveService;
    readonly discordChatService: DiscordChatService;
    readonly geminiLlmService: GeminiLlmService;
    readonly llmConversationService: LlmConversationService;
    readonly soundboardThreadService: SoundboardThreadService;
    readonly autoReactionService: AutoReactionService;
    readonly voiceEventSoundsService: VoiceEventSoundsService;
    readonly voiceService: VoiceService;
    readonly commandChoicesService: CommandChoicesService;
    readonly eventFilter?: EventFilter;
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
    voiceEventSoundsRepository,
    soundRepository,
    soundService,
    soundTagService,
    reactionRepository,
    emoteRepository,
    reactionArchiveService,
    messageArchiveService,
    discordChatService,
    geminiLlmService,
    llmConversationService,
    soundboardThreadService,
    autoReactionService,
    voiceEventSoundsService,
    voiceService,
    commandChoicesService,
    eventFilter,
}: DiscordBotDeps): Promise<DiscordBot> => {
    let client: Client;
    let isReadyState = false;
    let isClientDestroyed = false;
    let readyResolver: (() => void) | null = null;

    const createClient = (): Client => {
        return new Client({
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
    };

    const registerEventHandler = <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>): void => {
        if (!client) {
            throw new Error("Discord client is not initialized. Call start() before registering event handlers.");
        }

        if (isClientDestroyed) {
            throw new Error("Discord client has been destroyed. Cannot register new event handlers.");
        }

        const wrappedHandler = eventFilter
            ? (...args: ClientEvents[K]): void | Promise<void> => {
                  if (!eventFilter(event, args)) {
                      return;
                  }
                  return handler(...args);
              }
            : handler;

        client.on(event, wrappedHandler);
    };

    const setupEventHandlers = (): void => {
        client.once(Events.ClientReady, async (readyClient: Client<true>) => {
            client.user!.setStatus(PresenceUpdateStatus.Invisible);
            console.log(`🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
            console.log(`📊 Bot is in ${readyClient.guilds.cache.size} servers`);
            isReadyState = true;

            if (!config.discord.skipCommandDeploymentOnStartup) {
                try {
                    console.log("⏱️  Deploying Discord commands...");
                    const deployStart = Date.now();
                    await deployCommands(
                        voiceEventSoundsRepository,
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
                    console.log(`✅ Commands deployed in ${Date.now() - deployStart}ms`);
                } catch (error) {
                    console.warn("⚠️ Failed to deploy commands automatically:", error);
                    console.log("💡 You can deploy commands manually with: pnpm discord:deploy-commands");
                }
            } else {
                console.log("⏩ Skipping command deployment (skipCommandDeploymentOnStartup = true)");
            }

            if (readyResolver) {
                readyResolver();
                readyResolver = null;
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

        registerCommands(voiceEventSoundsRepository, soundRepository, soundService, soundTagService, voiceService, reactionRepository, emoteRepository, discordChatService, commandChoicesService, registerEventHandler);

        // Register message and reaction events
        registerMessageArchiveEvents(messageArchiveService, registerEventHandler);
        registerReactionArchiveEvents(reactionArchiveService, registerEventHandler);
        registerLlmConversationServiceEventHandlers(llmConversationService, registerEventHandler);
        registerSoundboardThreadEventHandlers(soundboardThreadService, registerEventHandler);
        registerVoiceServiceEventHandlers(config, voiceService, registerEventHandler);
        registerAutoReactionEvents(autoReactionService, registerEventHandler);
        registerVoiceEventSoundsEventHandlers(voiceEventSoundsService, registerEventHandler);
    };

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting Discord bot...");
            const botStartTime = Date.now();

            console.log("⏱️  Creating Discord client...");
            if (!client || isClientDestroyed) {
                client = createClient();
                isClientDestroyed = false;
                setupEventHandlers();
            }
            console.log(`✅ Client created in ${Date.now() - botStartTime}ms`);

            const readyPromise = new Promise<void>(resolve => {
                readyResolver = resolve;
            });

            console.log("⏱️  Logging in to Discord...");
            const loginStart = Date.now();
            await client.login(config.discord.token);

            await readyPromise;
            console.log(`✅ Discord login and ready in ${Date.now() - loginStart}ms`);

            console.log("⏱️  Fetching guild and channels...");
            const guildStart = Date.now();
            const guild = await client.guilds.fetch(config.discord.serverId!);
            await guild.fetch();
            const botChannel = (await guild.channels.fetch(config.discord.botChannelId)) as TextChannel;
            console.log(`✅ Guild and channels fetched in ${Date.now() - guildStart}ms`);

            console.log("⏱️  Creating karma emotes...");
            const emotesStart = Date.now();
            await emoteRepository.createKarmaEmotes(guild);
            console.log(`✅ Karma emotes created in ${Date.now() - emotesStart}ms`);

            if (!config.discord.skipChannelProcessingOnStartup) {
                const isFirstRun = !(await messageArchiveService.hasAnyMessages());
                const currentYear = new Date().getUTCFullYear();

                if (isFirstRun) {
                    console.log("🔄 First run detected - performing full message sync (all years)");
                    await messageArchiveService.processAllChannels(guild);
                } else {
                    console.log(`🔄 Processing messages for ${currentYear} only`);
                    await messageArchiveService.processAllChannels(guild, currentYear);
                }

                await messageArchiveService.removeDeletedMessages(guild, isFirstRun ? undefined : currentYear);
            }

            await soundboardThreadService.findOrCreateSoundboardThread(guild);

            client.user!.setStatus(PresenceUpdateStatus.Online);

            if (config.server.environment === "production") {
                const status = await geminiLlmService.generateMessage("", [], "discordStatus");
                console.log(`✏ Setting Discord status to: "${status}"`);
                client.user!.setActivity(status);

                await botChannel.send("WTB3 online and ready");
            }

            console.log(`✅ Discord bot fully started in ${Date.now() - botStartTime}ms`);
        } catch (error) {
            console.error("❌ Failed to start Discord bot:", error);
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
        try {
            console.log("🛑 Stopping Discord bot...");
            isReadyState = false;

            await sleep(50);

            client.user?.setStatus(PresenceUpdateStatus.Invisible);

            await client.destroy();
            isClientDestroyed = true;
            console.log("✅ Discord bot stopped");
        } catch (error) {
            console.error("❌ Error stopping Discord bot:", error);
            throw error;
        }
    };

    const isReady = (): boolean => isReadyState;

    client = createClient();
    setupEventHandlers();

    return {
        get client() {
            return client;
        },
        isReady,
        start,
        stop,
        registerEventHandler,
    };
};
