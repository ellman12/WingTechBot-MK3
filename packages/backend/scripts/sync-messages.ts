#!/usr/bin/env tsx

import { getConfig } from "@adapters/config/ConfigAdapter.js";
import { createUnitOfWork } from "@adapters/repositories/KyselyUnitOfWork.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import { loadEnvironment } from "@infrastructure/config/EnvLoader.js";
import { createDatabaseConnection } from "@infrastructure/database/DatabaseConnection.js";
import { createFileManager } from "@infrastructure/filestore/FileManager.js";
import { Client, GatewayIntentBits } from "discord.js";

// Parse command-line arguments
const args = process.argv.slice(2);
const flags = {
    year: args.includes("--year") ? parseInt(args[args.indexOf("--year") + 1]) : undefined,
    resume: args.includes("--resume"),
    channels: args.includes("--channels") ? args[args.indexOf("--channels") + 1].split(",") : undefined,
    help: args.includes("--help") || args.includes("-h"),
};

if (flags.help) {
    console.log(`
📦 Message Archive Sync Script

Synchronizes Discord messages to the database. This script can be run manually
or scheduled via cron for periodic syncing.

Usage:
  pnpm sync-messages [options]

Options:
  --year <year>          Only sync messages from specified year (e.g., 2024)
  --channels <ids>       Comma-separated list of channel IDs to sync
  --resume               Resume from previous interrupted sync
  --help, -h             Show this help message

Examples:
  pnpm sync-messages                           # Sync all messages from all channels
  pnpm sync-messages --year 2024               # Sync only 2024 messages
  pnpm sync-messages --resume                  # Resume interrupted sync
  pnpm sync-messages --channels 123,456        # Sync specific channels
  pnpm sync-messages --year 2024 --channels 123  # Combine options

Cron Examples:
  # Daily at 3 AM
  0 3 * * * cd /path/to/WingTechBot-MK3 && pnpm sync-messages --year $(date +%Y)

  # Every 6 hours
  0 */6 * * * cd /path/to/WingTechBot-MK3 && pnpm sync-messages --year $(date +%Y)
`);
    process.exit(0);
}

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
