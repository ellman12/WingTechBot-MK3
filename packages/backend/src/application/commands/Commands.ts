import { createReactionCommands } from "@application/commands/ReactionCommands.js";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { SoundTagService } from "@core/services/SoundTagService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { ChatInputCommandInteraction, Events, MessageFlags, REST, Routes, type SlashCommandOptionsOnlyBuilder } from "discord.js";

import type { DiscordBot } from "@/infrastructure/discord/DiscordBot.js";

import { createAudioCommands } from "./AudioCommands.js";
import { createSoundTagCommands } from "./SoundTagCommands.js";
import { createVoiceCommands } from "./VoiceCommands.js";

export type Command = {
    readonly data: SlashCommandOptionsOnlyBuilder;
    readonly execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export const createCommands = (
    soundService: SoundService,
    soundTagService: SoundTagService,
    voiceService: VoiceService,
    reactionRepository: ReactionRepository,
    emoteRepository: ReactionEmoteRepository,
    discordChatService: DiscordChatService
): Record<string, Command> => {
    const commandRecords = [
        createAudioCommands({ soundService, discordChatService }),
        createReactionCommands({ reactionRepository, emoteRepository, discordChatService }),
        createSoundTagCommands({ soundTagService, discordChatService }),
        createVoiceCommands({ voiceService, soundService }),
    ];

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

export const deployCommands = async (
    soundService: SoundService,
    soundTagService: SoundTagService,
    voiceService: VoiceService,
    reactionRepository: ReactionRepository,
    emoteRepository: ReactionEmoteRepository,
    discordChatService: DiscordChatService,
    token: string,
    clientId: string,
    guildId?: string
): Promise<void> => {
    try {
        console.log("🚀 Deploying Discord commands...");

        const commandMap = createCommands(soundService, soundTagService, voiceService, reactionRepository, emoteRepository, discordChatService);
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

export const registerCommands = (
    soundService: SoundService,
    soundTagService: SoundTagService,
    voiceService: VoiceService,
    reactionRepository: ReactionRepository,
    emoteRepository: ReactionEmoteRepository,
    discordChatService: DiscordChatService,
    registerEventHandler: DiscordBot["registerEventHandler"]
): void => {
    console.log("🔄 Registering commands...");

    const commands = createCommands(soundService, soundTagService, voiceService, reactionRepository, emoteRepository, discordChatService);
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
            await interaction.reply({ content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral });
        }
    });
};
