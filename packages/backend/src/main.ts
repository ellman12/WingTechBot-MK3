#!/usr/bin/env node
import { createKyselySoundRepository } from "@adapters/repositories/KyselySoundRepository";
import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService";
import { createYtdlYoutubeService } from "@adapters/services/YtdlYoutubeAudioService";
import { createAudioFetcherService } from "@core/services/AudioFetcherService";
import { createSoundService } from "@core/services/SoundService";
import "@dotenvx/dotenvx/config";
import { getConfig } from "@infrastructure/config/Config.js";
import { connect, disconnect, getKysely, healthCheck } from "@infrastructure/database/DatabaseConnection.js";
import { createDiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService";
import { createFileManager } from "@infrastructure/filestore/FileManager";
import { type ServerConfig, createExpressApp } from "@infrastructure/http/ExpressApp";

export type App = {
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
};

export const createApplication = async (): Promise<App> => {
    const config = getConfig();

    await connect();

    // Initialize Infrastructure
    const db = getKysely();
    const serverConfig: ServerConfig = {
        port: config.server.port,
        nodeEnv: process.env.NODE_ENV || "development",
        corsOrigin: process.env.CORS_ORIGIN || false,
    };

    const fileManager = createFileManager();
    const ffmpeg = createFfmpegService();
    const ytdl = createYtdlYoutubeService();

    // Initialize Repositories
    const soundRepository = createKyselySoundRepository(db);

    // Initialize Services
    const audioProcessingService = createFfmpegAudioProcessingService({ ffmpeg });
    const audioFetchService = createAudioFetcherService({ fileManager, soundRepository, youtubeService: ytdl });
    const soundService = createSoundService({
        audioFetcher: audioFetchService,
        audioProcessor: audioProcessingService,
        fileManager,
        soundRepository,
    });

    const expressApp = createExpressApp({ db, config: serverConfig });
    const discordBot = createDiscordBot({ config, soundService });

    const runMigrations = async (): Promise<void> => {
        try {
            const isHealthy = await healthCheck();

            if (!isHealthy) {
                throw new Error("Database health check failed");
            }

            console.log("✅ Database is ready");
        } catch (error) {
            console.error("❌ Database migration failed:", error);
            throw error;
        }
    };

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting WingTechBot MK3...");

            await runMigrations();
            await discordBot.start();
            expressApp.start();

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
        const app = await createApplication();
        await app.start();
        setupGracefulShutdown(app);
    } catch (error) {
        console.error("❌ Failed to start application:", error);
        process.exit(1);
    }
};

void startApplication();
