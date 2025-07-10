#!/usr/bin/env node
import '@dotenvx/dotenvx/config';
import type { Application } from 'express';

import { ConfigService } from './infrastructure/config/Config.js';
import { DatabaseConnection } from './infrastructure/database/DatabaseConnection.js';
import { DiscordBot } from './infrastructure/discord/DiscordBot.js';
import {
  type ServerConfig,
  createExpressApp,
  startServer,
} from './infrastructure/http/ExpressApp.js';

interface AppDependencies {
  readonly configService: ConfigService;
  readonly databaseConnection: DatabaseConnection;
  readonly discordBot: DiscordBot;
  readonly expressApp: Application;
}

const createAppDependencies = async (): Promise<AppDependencies> => {
  const configService = ConfigService.getInstance();
  const config = configService.getConfig();

  const databaseConnection = DatabaseConnection.getInstance();
  await databaseConnection.connect();

  const serverConfig: ServerConfig = {
    port: config.server.port,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || false,
  };

  const expressApp = createExpressApp(databaseConnection.getKysely(), serverConfig);
  const discordBot = new DiscordBot(config, databaseConnection.getKysely());

  return {
    configService,
    databaseConnection,
    discordBot,
    expressApp,
  };
};

const runMigrations = async (databaseConnection: DatabaseConnection): Promise<void> => {
  try {
    const isHealthy = await databaseConnection.healthCheck();

    if (!isHealthy) {
      throw new Error('Database health check failed');
    }

    console.log('✅ Database is ready');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};

const setupGracefulShutdown = (dependencies: AppDependencies): void => {
  const shutdown = async (exitCode = 0): Promise<void> => {
    try {
      console.log('🛑 Shutting down application...');

      // Stop Discord bot
      await dependencies.discordBot.stop();

      // Disconnect from database
      await dependencies.databaseConnection.disconnect();

      console.log('✅ Application shut down gracefully');
      process.exit(exitCode);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;

  signals.forEach(signal => {
    process.on(signal, () => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
      void shutdown();
    });
  });

  process.on('uncaughtException', error => {
    console.error('❌ Uncaught Exception:', error);
    void shutdown(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    void shutdown(1);
  });
};

const startApplication = async (): Promise<void> => {
  try {
    console.log('🚀 Starting WingTechBot MK3...');

    const dependencies = await createAppDependencies();
    await runMigrations(dependencies.databaseConnection);
    await dependencies.discordBot.start();

    const config = dependencies.configService.getConfig();
    startServer(dependencies.expressApp, config.server.port);

    console.log('✅ Application started successfully!');
    setupGracefulShutdown(dependencies);
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
};

void startApplication();
