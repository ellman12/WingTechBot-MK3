#!/usr/bin/env node
import { getConfig } from "@adapters/config/ConfigAdapter.js";
import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork.js";
import { createLlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { createSoundRepository } from "@adapters/repositories/SoundRepository.js";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository.js";
import { createVoiceEventsSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import { createDiscordVoiceService } from "@adapters/services/DiscordVoiceService.js";
import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService.js";
import { createYtdlYoutubeService } from "@adapters/services/YtdlYoutubeAudioService.js";
import { createAudioCacheService } from "@core/services/AudioCacheService.js";
import { createAudioFetcherService } from "@core/services/AudioFetcherService.js";
import { AudioFormatDetectionService } from "@core/services/AudioFormatDetectionService.js";
import { createAutoReactionService } from "@core/services/AutoReactionService.js";
import { createCommandChoicesService } from "@core/services/CommandChoicesService.js";
import { createDiscordChatService } from "@core/services/DiscordChatService.js";
import { createLlmConversationService } from "@core/services/LlmConversationService.js";
import { type MessageArchiveService, createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import { createReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import { createSoundService } from "@core/services/SoundService.js";
import { createSoundTagService } from "@core/services/SoundTagService.js";
import { createSoundboardThreadService } from "@core/services/SoundboardThreadService.js";
import { createVoiceEventSoundsService } from "@core/services/VoiceEventSoundsService.js";
import { runMigrations } from "@db/migrations.js";
import { loadEnvironment } from "@infrastructure/config/EnvLoader.js";
import { connect, disconnect, getKysely } from "@infrastructure/database/DatabaseConnection.js";
import { type DiscordBot, createDiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { FfprobeService } from "@infrastructure/ffmpeg/FfprobeService.js";
import { createFileManager } from "@infrastructure/filestore/FileManager.js";
import { type ServerConfig, createExpressApp } from "@infrastructure/http/ExpressApp.js";
import { type ErrorReportingService, createErrorReportingService } from "@infrastructure/services/ErrorReportingService.js";
import { createGeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";

export type App = {
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly discordBot: DiscordBot;
    readonly isReady: () => boolean;
    readonly errorReportingService: ErrorReportingService;
    readonly messageArchiveService: MessageArchiveService;
};

export const createApplication = async (): Promise<App> => {
    await loadEnvironment();
    const config = getConfig();

    const errorReportingService = await createErrorReportingService({ config });

    await connect();

    const db = getKysely();
    const serverConfig: ServerConfig = {
        port: config.server.port,
        nodeEnv: process.env.NODE_ENV || "development",
        corsOrigin: process.env.CORS_ORIGIN || false,
    };

    const fileManager = createFileManager();
    const ffmpeg = createFfmpegService();

    const ffprobeService = new FfprobeService(config);
    const audioFormatDetectionService = new AudioFormatDetectionService(ffprobeService);

    const soundRepository = createSoundRepository(db);
    const voiceEventSoundsRepository = createVoiceEventsSoundsRepository(db);
    const soundTagRepository = createSoundTagRepository(db);
    const messageRepository = createMessageRepository(db);
    const reactionRepository = createReactionRepository(db);
    const emoteRepository = createReactionEmoteRepository(db);
    const llmInstructionRepo = createLlmInstructionRepository(fileManager);

    if (!process.env.CI) {
        await llmInstructionRepo.validateInstructions();
    }

    const commandChoicesService = createCommandChoicesService({ soundRepository, soundTagRepository });
    const audioProcessingService = createFfmpegAudioProcessingService({ ffmpeg });
    const audioCacheService = createAudioCacheService({ fileManager, config });

    const ytdlWithFormatDetection = createYtdlYoutubeService(audioFormatDetectionService);

    const audioFetchService = createAudioFetcherService({
        fileManager,
        soundRepository,
        youtubeService: ytdlWithFormatDetection,
        cacheService: audioCacheService,
        formatDetectionService: audioFormatDetectionService,
    });
    const soundService = createSoundService({
        audioFetcher: audioFetchService,
        audioProcessor: audioProcessingService,
        fileManager,
        soundRepository,
        config,
    });
    const unitOfWork = createUnitOfWork(db);
    const soundTagService = createSoundTagService({ unitOfWork, soundRepository, soundTagRepository });
    const reactionArchiveService = createReactionArchiveService({ messageRepository, reactionRepository, emoteRepository });
    const messageArchiveService = createMessageArchiveService({
        unitOfWork,
        messageRepository,
    });
    const geminiLlmService = createGeminiLlmService();
    const voiceService = createDiscordVoiceService({ soundService });
    const discordChatService = createDiscordChatService();
    const llmConversationService = createLlmConversationService({ discordChatService, geminiLlmService, messageArchiveService, llmInstructionRepo });
    const soundboardThreadService = createSoundboardThreadService({ soundRepository, voiceService });
    const autoReactionService = createAutoReactionService({ discordChatService, geminiLlmService, llmInstructionRepo });
    const voiceEventSoundsService = createVoiceEventSoundsService({ voiceEventSoundsRepository, voiceService });

    const expressApp = createExpressApp({ db, config: serverConfig });
    const discordBot = await createDiscordBot({
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
    });

    let isReadyState = false;

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting WingTechBot MK3...");

            await runMigrations();
            await discordBot.start();
            expressApp.start();

            console.log("✅ Application started successfully!");
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

            await disconnect();

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

        // After an uncaught exception, always perform a graceful shutdown to avoid running in an inconsistent state
        void shutdown(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
        console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
        const error = reason instanceof Error ? reason : new Error(String(reason));
        void app.errorReportingService.reportError(error, { source: "unhandledRejection", promise: String(promise), willShutdown: false });

        // Unhandled rejections are usually less critical - just log and continue
        // In dev/test environments, we could optionally crash for stricter error handling
    });
};

const startApplication = async (): Promise<void> => {
    try {
        app = await createApplication();
        await app.start();
        setupGracefulShutdown(app);
    } catch (error) {
        console.error("❌ Failed to start application:", error);
        if (process.env.NODE_ENV === "test" || process.env.CI) {
            throw error; // Re-throw in tests so they fail
        }
        process.exit(1); // Exit in production
    }
};

export let app: App;

export const getApp = () => app;

void startApplication();
