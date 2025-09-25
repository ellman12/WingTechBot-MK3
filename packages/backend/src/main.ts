#!/usr/bin/env node
import { createMessageRepository } from "@adapters/repositories/MessageRepository";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository";
import { createSoundRepository } from "@adapters/repositories/SoundRepository";
import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService";
import { createYtdlYoutubeService } from "@adapters/services/YtdlYoutubeAudioService";
import { createAudioFetcherService } from "@core/services/AudioFetcherService";
import { createMessageService } from "@core/services/MessageService";
import { createReactionService } from "@core/services/ReactionService";
import { createSoundService } from "@core/services/SoundService";
import { runMigrations } from "@db/migrations";
import "@dotenvx/dotenvx/config";
import { getConfig } from "@infrastructure/config/Config.js";
import { connect, disconnect, getKysely } from "@infrastructure/database/DatabaseConnection.js";
import { type DiscordBot, createDiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService";
import { createFileManager } from "@infrastructure/filestore/FileManager";
import { type ServerConfig, createExpressApp } from "@infrastructure/http/ExpressApp";

export type App = {
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly discordBot: DiscordBot;
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
    const messageRepository = createMessageRepository(db);
    const reactionRepository = createReactionRepository(db);
    const emoteRepository = createReactionEmoteRepository(db);

    const audioProcessingService = createFfmpegAudioProcessingService({ ffmpeg });
    const audioFetchService = createAudioFetcherService({ fileManager, soundRepository, youtubeService: ytdl });
    const soundService = createSoundService({
        audioFetcher: audioFetchService,
        audioProcessor: audioProcessingService,
        fileManager,
        soundRepository,
    });
    const reactionService = createReactionService({ reactionRepository, emoteRepository });
    const messageService = createMessageService({ messageRepository, reactionRepository, emoteRepository });

    const expressApp = createExpressApp({ db, config: serverConfig });
    const discordBot = createDiscordBot({ config, soundService, reactionService, messageService });

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting WingTechBot MK3...");

            await runMigrations();
            await discordBot.start();
            expressApp.start();

            //If first boot, pull in all messages from all time. Otherwise, just get this year's.
            //Prevented from running on CI/CD.
            if (process.env.NODE_ENV !== "test") {
                const guild = discordBot.client.guilds.cache.get(config.discord.serverId!)!;
                const year = (await messageRepository.getAllMessages()).length === 0 ? undefined : new Date().getUTCFullYear();
                await messageService.processAllChannels(guild, year);

                //Remove any messages that were deleted while bot offline.
                await messageService.removeDeletedMessages(guild, year);
            }

            console.log("✅ Application started successfully!");
        } catch (error) {
            console.error("❌ Failed to start application:", error);
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
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

    return {
        start,
        stop,
        discordBot,
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
        process.exit(1);
    }
};

export let app: App;

export const getApp = () => app;

void startApplication();
