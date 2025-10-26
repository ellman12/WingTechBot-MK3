#!/usr/bin/env node
import { createLlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { createSoundRepository } from "@adapters/repositories/SoundRepository.js";
import { createSoundTagRepository } from "@adapters/repositories/SoundTagRepository.js";
import { createDiscordVoiceService } from "@adapters/services/DiscordVoiceService.js";
import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService.js";
import { createYtdlYoutubeService } from "@adapters/services/YtdlYoutubeAudioService.js";
import { createAudioFetcherService } from "@core/services/AudioFetcherService.js";
import { createAutoReactionService } from "@core/services/AutoReactionService.js";
import { createDiscordChatService } from "@core/services/DiscordChatService.js";
import { createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import { createReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import { createSoundService } from "@core/services/SoundService.js";
import { createSoundTagService } from "@core/services/SoundTagService.js";
import { runMigrations } from "@db/migrations.js";
import "@dotenvx/dotenvx/config";
import { getConfig } from "@infrastructure/config/Config.js";
import { connect, disconnect, getKysely } from "@infrastructure/database/DatabaseConnection.js";
import { type DiscordBot, createDiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { createFileManager } from "@infrastructure/filestore/FileManager.js";
import { type ServerConfig, createExpressApp } from "@infrastructure/http/ExpressApp.js";
import { createGeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";

export type App = {
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly discordBot: DiscordBot;
    readonly isReady: () => boolean;
};

export const createApplication = async (): Promise<App> => {
    const config = getConfig();

    await connect();

    const db = getKysely();
    const serverConfig: ServerConfig = {
        port: config.server.port,
        nodeEnv: process.env.NODE_ENV || "development",
        corsOrigin: process.env.CORS_ORIGIN || false,
    };

    const fileManager = createFileManager();
    const ffmpeg = createFfmpegService();
    const ytdl = createYtdlYoutubeService();

    const soundRepository = createSoundRepository(db);
    const soundTagRepository = createSoundTagRepository(db);
    const messageRepository = createMessageRepository(db);
    const reactionRepository = createReactionRepository(db);
    const emoteRepository = createReactionEmoteRepository(db);
    const llmInstructionRepo = createLlmInstructionRepository(fileManager);

    const audioProcessingService = createFfmpegAudioProcessingService({ ffmpeg });
    const audioFetchService = createAudioFetcherService({ fileManager, soundRepository, youtubeService: ytdl });
    const soundService = createSoundService({
        audioFetcher: audioFetchService,
        audioProcessor: audioProcessingService,
        fileManager,
        soundRepository,
    });
    const soundTagService = createSoundTagService({ soundRepository, soundTagRepository });
    const reactionArchiveService = createReactionArchiveService({ reactionRepository, emoteRepository });
    const messageArchiveService = createMessageArchiveService({
        messageRepository,
        reactionRepository,
        emoteRepository,
    });
    const geminiLlmService = createGeminiLlmService();
    const discordChatService = createDiscordChatService({
        geminiLlmService,
        messageArchiveService,
        llmInstructionRepo,
    });
    const autoReactionService = createAutoReactionService({ discordChatService, geminiLlmService, llmInstructionRepo });
    const voiceService = createDiscordVoiceService({ soundService });

    const expressApp = createExpressApp({ db, config: serverConfig });
    const discordBot = await createDiscordBot({
        config,
        soundService,
        soundTagService,
        reactionRepository,
        emoteRepository,
        reactionArchiveService,
        messageArchiveService,
        discordChatService,
        autoReactionService,
        voiceService,
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
        void shutdown(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
        console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
        void shutdown(1);
    });
};

const startApplication = async (): Promise<void> => {
    try {
        app = await createApplication();
        await app.start();
        setupGracefulShutdown(app);
    } catch (error) {
        console.error("❌ Failed to start application:", error);
    }
};

export let app: App;

export const getApp = () => app;

void startApplication();
