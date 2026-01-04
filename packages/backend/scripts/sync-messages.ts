#!/usr/bin/env tsx

import { getConfig } from "@adapters/config/ConfigAdapter.js";
import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import { loadEnvironment } from "@infrastructure/config/EnvLoader.js";
import { createDatabaseConnection } from "@infrastructure/database/DatabaseConnection.js";
import { createFileManager } from "@infrastructure/filestore/FileManager.js";
import { Command } from "commander";
import { Client, GatewayIntentBits } from "discord.js";

// Parse command-line arguments with Commander
const program = new Command();

program
    .name("sync-messages")
    .description("📦 Synchronizes Discord messages to the database. Can be run manually or scheduled via cron.")
    .version("1.0.0")
    .option("-y, --year <year>", "Only sync messages from specified year (e.g., 2024)", parseInt)
    .option("-c, --channels <ids>", "Comma-separated list of channel IDs to sync", value => value.split(","))
    .option("-r, --resume", "Resume from previous interrupted sync", false)
    .parse(process.argv);

const flags = program.opts();

const syncMessages = async () => {
    console.log("🚀 Starting message archive sync...\n");

    // Load environment
    await loadEnvironment();

    // Create config
    const config = await getConfig();

    // Connect to database
    console.log("📊 Connecting to database...");
    const databaseConnection = createDatabaseConnection(config);
    await databaseConnection.connect();
    const db = databaseConnection.getKysely();
    console.log("✅ Database connected\n");

    // Create dependencies
    const messageRepository = createMessageRepository(db);
    const unitOfWork = createUnitOfWork(db);
    const fileManager = createFileManager();

    // Create message archive service
    const messageArchiveService = createMessageArchiveService({
        unitOfWork,
        messageRepository,
        fileManager,
    });

    // Create Discord client (minimal, just for fetching messages)
    console.log("🤖 Connecting to Discord...");
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    });

    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once("ready", resolve));
    console.log(`✅ Discord connected as ${client.user?.tag}\n`);

    // Get guild
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
        console.error("❌ DISCORD_GUILD_ID environment variable is required");
        process.exit(1);
    }

    const guild = await client.guilds.fetch(guildId);

    // Run sync
    const startTime = Date.now();
    try {
        await messageArchiveService.processAllChannels(guild, flags.year, flags.channels, flags.resume);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✨ Sync completed successfully in ${duration}s`);
    } catch (error) {
        console.error("\n❌ Sync failed:", error);
        process.exit(1);
    } finally {
        // Cleanup
        console.log("\n🧹 Cleaning up...");
        client.destroy();
        await databaseConnection.disconnect();
        console.log("✅ Cleanup complete");
    }
};

syncMessages().catch(error => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
});
