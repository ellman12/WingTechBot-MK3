#!/usr/bin/env node
import "@dotenvx/dotenvx/config";
import type { Application } from "express";

import { initializeUserRepository } from "./adapters/repositories/UserRepository.js";
import { getConfig } from "./infrastructure/config/Config.js";
import { connect, disconnect, getKysely, healthCheck } from "./infrastructure/database/DatabaseConnection.js";
import { initializeDiscordBot, startDiscordBot, stopDiscordBot } from "./infrastructure/discord/DiscordBot.js";
import { type ServerConfig, createExpressApp, startServer } from "./infrastructure/http/ExpressApp.js";

interface AppDependencies {
    readonly config: ReturnType<typeof getConfig>;
    readonly expressApp: Application;
}

const createAppDependencies = async (): Promise<AppDependencies> => {
    const config = getConfig();

    // Connect to database
    await connect();

    const serverConfig: ServerConfig = { port: config.server.port, nodeEnv: process.env.NODE_ENV || "development", corsOrigin: process.env.CORS_ORIGIN || false };

    const expressApp = createExpressApp(getKysely(), serverConfig);

    // Initialize repositories
    initializeUserRepository(getKysely());

    // Initialize Discord bot
    initializeDiscordBot(config);

    return { config, expressApp };
};

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

const setupGracefulShutdown = (): void => {
    const shutdown = async (exitCode = 0): Promise<void> => {
        try {
            console.log("🛑 Shutting down application...");

            // Stop Discord bot
            await stopDiscordBot();

            // Disconnect from database
            await disconnect();

            console.log("✅ Application shut down gracefully");
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
        console.log("🚀 Starting WingTechBot MK3...");

        const dependencies = await createAppDependencies();
        await runMigrations();
        await startDiscordBot();

        startServer(dependencies.expressApp, dependencies.config.server.port);

        console.log("✅ Application started successfully!");
        setupGracefulShutdown();
    } catch (error) {
        console.error("❌ Failed to start application:", error);
        process.exit(1);
    }
};

void startApplication();
