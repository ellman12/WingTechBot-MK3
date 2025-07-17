import type { SoundService } from "@core/services/SoundService";
import type { VoiceService } from "@core/services/VoiceService.js";
import { ChatInputCommandInteraction, Events, REST, Routes, type SlashCommandOptionsOnlyBuilder } from "discord.js";

import type { DiscordBot } from "@/infrastructure/discord/DiscordBot.js";

import { createAudioCommands } from "./AudioCommands.js";
import { createVoiceCommands } from "./VoiceCommands.js";

export type Command = {
    readonly data: SlashCommandOptionsOnlyBuilder;
    readonly execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export const createCommands = (soundService: SoundService, voiceService: VoiceService): Record<string, Command> => {
    const commandRecords = [createAudioCommands({ soundService }), createVoiceCommands({ voiceService, soundService })];

    // Assert that there are no duplicate command name in a way where we can have an arbitrary number of commands
    const commandNames = new Set<string>();
    const commandMap: Record<string, Command> = {};
    commandRecords.forEach(record => {
        Object.keys(record).forEach(name => {
            if (commandNames.has(name)) {
                throw new Error(`Duplicate command name found: ${name}`);
            }

            if (record[name] == null) {
                throw new Error(`Command ${name} is not defined in the record`);
            }

            commandMap[name] = record[name];
            commandNames.add(name);
        });
    });

    return commandMap;
};

export const deployCommands = async (soundService: SoundService, voiceService: VoiceService, token: string, clientId: string, guildId?: string): Promise<void> => {
    try {
        console.log("🚀 Deploying Discord commands...");

        const commandMap = createCommands(soundService, voiceService);
        const commands = Object.values(commandMap).map(command => command.data.toJSON());

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

export const registerCommands = (soundService: SoundService, voiceService: VoiceService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    console.log("🔄 Registering commands...");

    const commands = createCommands(soundService, voiceService);
    console.log(`✅ Registered ${Object.keys(commands).length} Commands:`);
    Object.keys(commands).forEach(command => {
        console.log(`- ${command}`);
    });

    registerEventHandler(Events.InteractionCreate, async interaction => {
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
