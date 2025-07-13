#!/usr/bin/env node
import "@dotenvx/dotenvx/config";

import { createUserRepository } from "./adapters/repositories/KyselyUserRepository.js";
import { getConfig } from "./infrastructure/config/Config.js";
import { connect, disconnect, getKysely, healthCheck } from "./infrastructure/database/DatabaseConnection.js";
import { type DiscordBot, createDiscordBot } from "./infrastructure/discord/DiscordBot.js";
import { type ExpressApp, type ServerConfig, createExpressApp } from "./infrastructure/http/ExpressApp.js";

export type AppDependencies = {
    readonly config: ReturnType<typeof getConfig>;
    readonly expressApp: ExpressApp;
    readonly discordBot: DiscordBot;
    readonly userRepository: ReturnType<typeof createUserRepository>;
};

export type App = {
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
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

    const expressApp = createExpressApp({ db, config: serverConfig });
    const discordBot = createDiscordBot({ config });
    const _userRepository = createUserRepository(db);

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
