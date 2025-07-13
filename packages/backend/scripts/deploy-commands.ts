#!/usr/bin/env node
import "@dotenvx/dotenvx/config";
import { REST, Routes } from "discord.js";

import { createVoiceCommands } from "../src/application/commands/voice-commands.js";

const deployCommands = async (): Promise<void> => {
    try {
        console.log("🚀 Deploying Discord commands...");

        const token = process.env.DISCORD_TOKEN;
        const clientId = process.env.DISCORD_CLIENT_ID;
        const guildId = process.env.DISCORD_GUILD_ID;

        if (!token) {
            throw new Error("DISCORD_TOKEN environment variable is required");
        }

        if (!clientId) {
            throw new Error("DISCORD_CLIENT_ID environment variable is required");
        }

        // Create voice commands (we need a mock voice service for this)
        const mockVoiceService = {
            connect: async () => {},
            disconnect: async () => {},
            isConnected: () => false,
            playAudio: async () => {},
            stopAudio: async () => {},
            isPlaying: () => false,
            setVolume: async () => {},
            getVolume: () => 50,
            pause: async () => {},
            resume: async () => {},
        };

        const voiceCommands = createVoiceCommands(mockVoiceService);

        // Extract command data for deployment
        const commands = Object.values(voiceCommands).map(command => command.data.toJSON());

        console.log(`📋 Deploying ${commands.length} commands:`);
        commands.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });

        const rest = new REST({ version: "10" }).setToken(token);

        if (guildId) {
            // Deploy to specific guild (faster for development)
            console.log(`🎯 Deploying to guild: ${guildId}`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log("✅ Commands deployed to guild successfully!");
        } else {
            // Deploy globally (takes up to 1 hour to propagate)
            console.log("🌍 Deploying commands globally...");
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log("✅ Commands deployed globally successfully!");
            console.log("⏰ Note: Global commands may take up to 1 hour to appear in all servers");
        }
    } catch (error) {
        console.error("❌ Failed to deploy commands:", error);
        process.exit(1);
    }
};

// Run the deployment
deployCommands();
