import { REST, Routes } from "discord.js";

import { loadEnvironment } from "../src/infrastructure/config/EnvLoader.js";

await loadEnvironment();

const clearCommands = async () => {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !clientId) {
        console.error("❌ Missing required environment variables: DISCORD_TOKEN and DISCORD_CLIENT_ID");
        process.exit(1);
    }

    const rest = new REST({ version: "10" }).setToken(token);

    try {
        console.log("🧹 Clearing Discord commands...\n");

        // Clear guild commands if guildId is provided
        if (guildId) {
            console.log(`🎯 Clearing guild commands for guild: ${guildId}`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log("✅ Guild commands cleared successfully!");
        }

        // Clear global commands
        console.log("🌍 Clearing global commands...");
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log("✅ Global commands cleared successfully!");
        console.log("⏰ Note: Global command changes may take up to 1 hour to propagate\n");

        console.log("✨ All commands cleared! You can now redeploy with fresh commands.");
    } catch (error) {
        console.error("❌ Failed to clear commands:", error);
        process.exit(1);
    }
};

clearCommands();
