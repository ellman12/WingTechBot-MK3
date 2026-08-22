#!/usr/bin/env node
import { createFfmpegAudioProcessingService } from "@adapters/audio/FfmpegAudioProcessingService.js";
import { createFfprobeAudioProbe } from "@adapters/audio/FfprobeAudioProbe.js";
import { createYtdlYoutubeService } from "@adapters/audio/YtdlYoutubeAudioService.js";
import { loadConfig } from "@adapters/config/ConfigAdapter.js";
import { createDiscordVoiceService } from "@adapters/discord/DiscordVoiceService.js";
import { createFileManager } from "@adapters/filestore/FileManager.js";
import { createGeminiLlmService } from "@adapters/llm/GeminiLlmService.js";
import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork.js";
import { createLlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createPlayedSoundsRepository } from "@adapters/repositories/PlayedSoundsRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { createSoundRepository } from "@adapters/repositories/SoundRepository.js";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository.js";
import { createUserRepository } from "@adapters/repositories/UserRepository.js";
import { createVoiceEventsSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import { createCommands } from "@application/commands/Commands.js";
import { createAutoReaction } from "@application/discord/AutoReaction.js";
import { createDiscordApplication } from "@application/discord/DiscordApplication.js";
import { createDiscordChatService } from "@application/discord/DiscordChat.js";
import { createLlmConversation } from "@application/discord/LlmConversation.js";
import { type MessageSync, createMessageSync } from "@application/discord/MessageSync.js";
import { createReactionArchive } from "@application/discord/ReactionArchive.js";
import { createSoundboardThread } from "@application/discord/SoundboardThread.js";
import { createUserSync } from "@application/discord/UserSync.js";
import { createVoiceAutoJoin } from "@application/discord/VoiceAutoJoin.js";
import { createVoiceEventSounds } from "@application/discord/VoiceEventSounds.js";
import type { Config } from "@core/config/Config.js";
import { createAudioCacheService } from "@core/services/AudioCacheService.js";
import { createAudioFetcherService } from "@core/services/AudioFetcherService.js";
import { createAudioFormatDetectionService } from "@core/services/AudioFormatDetectionService.js";
import { createAutoReactionService } from "@core/services/AutoReactionService.js";
import { createBotStatusService } from "@core/services/BotStatusService.js";
import { createCommandChoicesService } from "@core/services/CommandChoicesService.js";
import { createLlmConversationService } from "@core/services/LlmConversationService.js";
import { type MessageArchiveService, createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import { createReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import { createSoundService } from "@core/services/SoundService.js";
import { createSoundTagService } from "@core/services/SoundTagService.js";
import { createSoundboardService } from "@core/services/SoundboardService.js";
import { createUserSyncService } from "@core/services/UserSyncService.js";
import { createVoiceEventSoundsService } from "@core/services/VoiceEventSoundsService.js";
import { runMigrations } from "@db/migrations.js";
import type { DB } from "@db/types.js";
import { loadEnvironment } from "@infrastructure/config/EnvLoader.js";
import { createDatabaseConnection } from "@infrastructure/database/DatabaseConnection.js";
import { type DiscordBot, createDiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { createDiscordClientHandle } from "@infrastructure/discord/DiscordClientHandle.js";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { createFfprobeService } from "@infrastructure/ffmpeg/FfprobeService.js";
import { type ErrorReportingService, createErrorReportingService } from "@infrastructure/services/ErrorReportingService.js";
import type { Kysely } from "kysely";

export type App = {
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly discordBot: DiscordBot;
    readonly isReady: () => boolean;
    readonly errorReportingService: ErrorReportingService;
    readonly messageArchiveService: MessageArchiveService;
    readonly messageSync: MessageSync;
    readonly getDatabase: () => Kysely<DB>;
    readonly config: Config;
};

//Composition root: the only place that knows about concrete adapters, infrastructure and application wiring together.
export const createApplication = async (overrideConfig?: Config, schemaName?: string): Promise<App> => {
    await loadEnvironment();
    const config = overrideConfig ?? loadConfig();
    const databaseConnection = createDatabaseConnection(config, schemaName);

    const errorReportingService = await createErrorReportingService({ config });

    await databaseConnection.connect();

    console.log("⏱️  Running database migrations...");
    const migrationsStart = Date.now();
    await runMigrations(schemaName);
    console.log(`✅ Migrations completed in ${Date.now() - migrationsStart}ms`);

    const db = databaseConnection.getKysely();

    //--- Infrastructure: process/tech wrappers
    const clientHandle = createDiscordClientHandle();
    const fileManager = createFileManager();
    const ffmpeg = createFfmpegService();
    const ffprobe = createFfprobeService({ config });

    //--- Adapters: repositories (driven ports over Postgres / filesystem)
    const unitOfWork = createUnitOfWork(db);
    const userRepository = createUserRepository(db);
    const soundRepository = createSoundRepository(db);
    const playedSoundsRepository = createPlayedSoundsRepository(db);
    const voiceEventSoundsRepository = createVoiceEventsSoundsRepository(db);
    const soundTagRepository = createSoundTagRepository(db);
    const messageRepository = createMessageRepository(db);
    const reactionRepository = createReactionRepository(db);
    const emoteRepository = createReactionEmoteRepository(db);
    const llmInstructionRepo = createLlmInstructionRepository({ config, fileManager });
    const bannedFeaturesRepository = createBannedFeaturesRepository(db);

    if (!process.env.CI) {
        await llmInstructionRepo.validateInstructions();
    }

    //--- Adapters: external capabilities (driven ports over ffmpeg / yt-dlp / Gemini / Discord voice)
    const audioProbe = createFfprobeAudioProbe({ ffprobe });
    const audioFormatDetectionService = createAudioFormatDetectionService({ audioProbe });
    const audioProcessingService = createFfmpegAudioProcessingService({ ffmpeg });
    const youtubeService = createYtdlYoutubeService({ formatDetectionService: audioFormatDetectionService });
    const llmService = createGeminiLlmService({ config });

    //--- Core: domain services (Discord-free)
    const audioCacheService = createAudioCacheService({ fileManager, config });
    const audioFetchService = createAudioFetcherService({ fileManager, soundRepository, youtubeService, cacheService: audioCacheService, formatDetectionService: audioFormatDetectionService });
    const soundService = createSoundService({ audioFetcher: audioFetchService, audioProcessor: audioProcessingService, fileManager, soundRepository, config });
    const voiceService = createDiscordVoiceService({ soundService, soundRepository, playedSoundsRepository, getClient: () => clientHandle.client });
    const soundTagService = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });
    const commandChoicesService = createCommandChoicesService({ soundRepository, soundTagRepository });
    const messageArchiveService = createMessageArchiveService({ unitOfWork, messageRepository });
    const reactionArchiveService = createReactionArchiveService({ messageRepository, reactionRepository, emoteRepository });
    const userSyncService = createUserSyncService({ userRepository, messageRepository, reactionRepository });
    const llmConversationService = createLlmConversationService({ config, messageRepository, llmService, llmInstructionRepo });
    const autoReactionService = createAutoReactionService({ config, llmService, llmInstructionRepo });
    const botStatusService = createBotStatusService({ llmService, llmInstructionRepo });
    const soundboardService = createSoundboardService({ config, soundRepository, voiceService, bannedFeaturesRepository });
    const voiceEventSoundsService = createVoiceEventSoundsService({ config, voiceEventSoundsRepository, voiceService });

    //--- Application: Discord-facing features (driving side)
    const discordChatService = createDiscordChatService({ config });
    const commands = createCommands({ voiceEventSoundsRepository, soundRepository, playedSoundsRepository, soundService, soundTagService, voiceService, reactionRepository, discordChatService, commandChoicesService, bannedFeaturesRepository });
    const messageSync = createMessageSync({ messageArchiveService, fileManager });
    const reactionArchive = createReactionArchive({ reactionArchiveService });
    const userSync = createUserSync({ userSyncService });
    const llmConversation = createLlmConversation({ config, discordChatService, llmConversationService, bannedFeaturesRepository });
    const autoReaction = createAutoReaction({ discordChatService, autoReactionService });
    const soundboardThread = createSoundboardThread({ config, soundboardService });
    const voiceAutoJoin = createVoiceAutoJoin({ config, voiceService });
    const voiceEventSounds = createVoiceEventSounds({ voiceEventSoundsService });

    const discordApplication = createDiscordApplication({
        config,
        emoteRepository,
        botStatusService,
        features: { commands, messageSync, reactionArchive, userSync, llmConversation, autoReaction, soundboardThread, voiceAutoJoin, voiceEventSounds },
    });

    //--- Infrastructure: host
    const discordBot = createDiscordBot({ config, clientHandle, application: discordApplication });

    let isReadyState = false;

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting WingTechBot MK3...");
            const startTime = Date.now();

            console.log("⏱️  Starting Discord bot...");
            const discordStart = Date.now();
            await discordBot.start();
            console.log(`✅ Discord bot started in ${Date.now() - discordStart}ms`);

            console.log(`✅ Application started successfully in ${Date.now() - startTime}ms!`);
            isReadyState = true;
        } catch (error) {
            console.error("❌ Failed to start application:", error);
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
        isReadyState = false;

        try {
            console.log("🛑 Shutting down application...");

            await discordBot.stop();

            errorReportingService.shutdown();

            await databaseConnection.disconnect();

            console.log("✅ Application shut down gracefully");
        } catch (error) {
            console.error("❌ Error during shutdown:", error);
            throw error;
        }
    };

    const isReady = (): boolean => isReadyState;

    return {
        start,
        stop,
        discordBot,
        isReady,
        errorReportingService,
        messageArchiveService,
        messageSync,
        getDatabase: () => db,
        config,
    };
};

const setupGracefulShutdown = (app: App): void => {
    const shutdown = async (exitCode = 0): Promise<void> => {
        try {
            await app.stop();
            process.exit(exitCode);
        } catch (error) {
            console.error("❌ Error during shutdown:", error);
            process.exit(1);
        }
    };

    const signals = ["SIGTERM", "SIGINT", "SIGUSR2"] as const;

    signals.forEach(signal => {
        process.on(signal, () => {
            console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
            void shutdown();
        });
    });

    process.on("uncaughtException", error => {
        console.error("❌ Uncaught Exception:", error);
        void app.errorReportingService.reportError(error, { source: "uncaughtException", willShutdown: true });

        void shutdown(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
        console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
        const error = reason instanceof Error ? reason : new Error(String(reason));
        void app.errorReportingService.reportError(error, { source: "unhandledRejection", promise: String(promise), willShutdown: false });
    });
};

if (process.env.NODE_ENV !== "test" && !process.env.CI) {
    const startApplication = async (): Promise<void> => {
        try {
            const app = await createApplication();
            await app.start();
            setupGracefulShutdown(app);
        } catch (error) {
            console.error("❌ Failed to start application:", error);
            process.exit(1);
        }
    };

    void startApplication();
}
