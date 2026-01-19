import type { BannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import type { VoiceEventSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import { createBannedFeaturesCommands } from "@application/commands/BannedFeaturesCommands.js";
import { createReactionCommands } from "@application/commands/ReactionCommands.js";
import { createVoiceEventSoundsCommands } from "@application/commands/VoiceEventSoundsCommands.js";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { SoundTagService } from "@core/services/SoundTagService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { type ApplicationCommandOptionChoiceData, type AutocompleteFocusedOption, ChatInputCommandInteraction, Events, MessageFlags, REST, Routes, type SlashCommandOptionsOnlyBuilder } from "discord.js";

import type { DiscordBot } from "@/infrastructure/discord/DiscordBot.js";

import { createAudioCommands } from "./AudioCommands.js";
import { createSoundTagCommands } from "./SoundTagCommands.js";
import { createVoiceCommands } from "./VoiceCommands.js";

export type Command = {
    readonly data: SlashCommandOptionsOnlyBuilder;
    readonly execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    readonly getAutocompleteChoices?: (focusedOption: AutocompleteFocusedOption) => Promise<ApplicationCommandOptionChoiceData[]>;
};

export const createCommands = (
    voiceEventSoundsRepository: VoiceEventSoundsRepository,
    soundRepository: SoundRepository,
    soundService: SoundService,
    soundTagService: SoundTagService,
    voiceService: VoiceService,
    reactionRepository: ReactionRepository,
    emoteRepository: ReactionEmoteRepository,
    discordChatService: DiscordChatService,
    commandChoicesService: CommandChoicesService,
    bannedFeaturesRepository: BannedFeaturesRepository
): Record<string, Command> => {
    const commandRecords = [
        createVoiceEventSoundsCommands({ voiceEventSoundsRepository, soundRepository, commandChoicesService }),
        createAudioCommands({ soundService, discordChatService, commandChoicesService }),
        createReactionCommands({ reactionRepository, emoteRepository, discordChatService }),
        createSoundTagCommands({ soundTagService, discordChatService, commandChoicesService }),
        createVoiceCommands({ voiceService, soundService, commandChoicesService, bannedFeaturesRepository }),
        createBannedFeaturesCommands({ bannedFeaturesRepository, discordChatService }),
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
    voiceEventSoundsRepository: VoiceEventSoundsRepository,
    soundRepository: SoundRepository,
    soundService: SoundService,
    soundTagService: SoundTagService,
    voiceService: VoiceService,
    reactionRepository: ReactionRepository,
    emoteRepository: ReactionEmoteRepository,
    discordChatService: DiscordChatService,
    commandChoicesService: CommandChoicesService,
    bannedFeaturesRepository: BannedFeaturesRepository,
    token: string,
    clientId: string,
    guildId?: string
): Promise<void> => {
    try {
        console.log("🚀 Deploying Discord commands...");

        const commandMap = createCommands(voiceEventSoundsRepository, soundRepository, soundService, soundTagService, voiceService, reactionRepository, emoteRepository, discordChatService, commandChoicesService, bannedFeaturesRepository);
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
    voiceEventSoundsRepository: VoiceEventSoundsRepository,
    soundRepository: SoundRepository,
    soundService: SoundService,
    soundTagService: SoundTagService,
    voiceService: VoiceService,
    reactionRepository: ReactionRepository,
    emoteRepository: ReactionEmoteRepository,
    discordChatService: DiscordChatService,
    commandChoicesService: CommandChoicesService,
    bannedFeaturesRepository: BannedFeaturesRepository,
    registerEventHandler: DiscordBot["registerEventHandler"]
): void => {
    console.log("🔄 Registering commands...");

    const commands = createCommands(voiceEventSoundsRepository, soundRepository, soundService, soundTagService, voiceService, reactionRepository, emoteRepository, discordChatService, commandChoicesService, bannedFeaturesRepository);
    console.log(`✅ Registered ${Object.keys(commands).length} Commands:`);
    Object.keys(commands).forEach(command => {
        console.log(`- ${command}`);
    });

    //Normal slash commands
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

    //Slash commands that have autocomplete options
    registerEventHandler(Events.InteractionCreate, async interaction => {
        if (interaction.isChatInputCommand() || !interaction.isAutocomplete()) return;

        const command = commands[interaction.commandName];
        if (!command) return;

        const focusedOption = interaction.options.getFocused(true);
        const choices = (await command.getAutocompleteChoices?.(focusedOption)) ?? [];
        await interaction.respond(choices.slice(0, 25));
    });
};
