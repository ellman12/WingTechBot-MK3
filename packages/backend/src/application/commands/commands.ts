import type { VoiceService } from "@core/services/VoiceService.js";
import { ChatInputCommandInteraction, Events, REST, Routes, type SlashCommandOptionsOnlyBuilder } from "discord.js";

import type { DiscordBot } from "@/infrastructure/discord/DiscordBot.js";

import { createVoiceCommands } from "./voice-commands.js";

export type Command = {
    data: SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export const deployCommands = async (token: string, clientId: string, guildId?: string, voiceService?: VoiceService): Promise<void> => {
    try {
        console.log("🚀 Deploying Discord commands...");

        const serviceToUse = voiceService || {
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

        const voiceCommands = createVoiceCommands(serviceToUse);
        const commands = Object.values(voiceCommands).map(command => command.data.toJSON());

        console.log(`📋 Deploying ${commands.length} commands:`);
        commands.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });

        const rest = new REST({ version: "10" }).setToken(token);

        if (guildId) {
            console.log(`🎯 Deploying to guild: ${guildId}`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log("✅ Commands deployed to guild successfully!");
        } else {
            console.log("🌍 Deploying commands globally...");
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log("✅ Commands deployed globally successfully!");
            console.log("⏰ Note: Global commands may take up to 1 hour to appear in all servers");
        }
    } catch (error) {
        console.error("❌ Failed to deploy commands:", error);
        throw error;
    }
};

export const registerCommands = (voiceService: VoiceService, discordBot: DiscordBot): void => {
    console.log("🔄 Registering commands...");
    const voiceCommands = createVoiceCommands(voiceService);

    const commands = Object.values(voiceCommands).reduce(
        (acc, command) => {
            acc[command.data.name] = command;
            return acc;
        },
        {} as Record<string, Command>
    );

    console.log(`✅ Registered ${Object.keys(commands).length} Commands:`);
    Object.keys(commands).forEach(command => {
        console.log(`- ${command}`);
    });

    discordBot.registerEventHandler(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand()) return;

        const command = commands[interaction.commandName];
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
        }
    });
};
