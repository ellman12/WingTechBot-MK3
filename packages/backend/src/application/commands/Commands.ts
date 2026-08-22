import { type AudioCommandDeps, createAudioCommands } from "@application/commands/AudioCommands.js";
import { type BannedFeaturesCommandsDeps, createBannedFeaturesCommands } from "@application/commands/BannedFeaturesCommands.js";
import { type PlayedSoundsCommandsDeps, createPlayedSoundsCommands } from "@application/commands/PlayedSoundsCommands.js";
import { type ReactionCommandDeps, createReactionCommands } from "@application/commands/ReactionCommands.js";
import { type SoundTagCommandDeps, createSoundTagCommands } from "@application/commands/SoundTagCommands.js";
import { type VoiceCommandDeps, createVoiceCommands } from "@application/commands/VoiceCommands.js";
import { type VoiceEventSoundsCommandsDeps, createVoiceEventSoundsCommands } from "@application/commands/VoiceEventSoundsCommands.js";
import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import { type ApplicationCommandOptionChoiceData, type AutocompleteFocusedOption, type ChatInputCommandInteraction, Events, MessageFlags, REST, Routes, type SlashCommandOptionsOnlyBuilder } from "discord.js";

export type Command = {
    readonly data: SlashCommandOptionsOnlyBuilder;
    readonly execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    readonly getAutocompleteChoices?: (focusedOption: AutocompleteFocusedOption) => Promise<ApplicationCommandOptionChoiceData[]>;
};

export type Commands = Readonly<Record<string, Command>>;

//Union of every command group's dependencies. Each group only receives what it declares.
export type CommandDeps = AudioCommandDeps & BannedFeaturesCommandsDeps & PlayedSoundsCommandsDeps & ReactionCommandDeps & SoundTagCommandDeps & VoiceCommandDeps & VoiceEventSoundsCommandsDeps;

export const createCommands = (deps: CommandDeps): Commands => {
    const commandRecords = [createVoiceEventSoundsCommands(deps), createAudioCommands(deps), createReactionCommands(deps), createPlayedSoundsCommands(deps), createSoundTagCommands(deps), createVoiceCommands(deps), createBannedFeaturesCommands(deps)];

    //Assert that there are no duplicate command names in a way where we can have an arbitrary number of commands
    const commandMap: Record<string, Command> = {};
    for (const record of commandRecords) {
        for (const [name, command] of Object.entries(record)) {
            if (name in commandMap) {
                throw new Error(`Duplicate command name found: ${name}`);
            }

            if (command == null) {
                throw new Error(`Command ${name} is not defined in the record`);
            }

            commandMap[name] = command;
        }
    }

    return commandMap;
};

export type DeployCommandsDeps = {
    readonly commands: Commands;
    readonly token: string;
    readonly clientId: string;
    readonly guildId?: string;
};

//Pushes the slash-command definitions to Discord (guild-scoped when guildId is given, global otherwise).
export const deployCommands = async ({ commands, token, clientId, guildId }: DeployCommandsDeps): Promise<void> => {
    try {
        console.log("🚀 Deploying Discord commands...");

        const body = Object.values(commands).map(command => command.data.toJSON());

        console.log(`📋 Deploying ${body.length} commands:`);
        body.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });

        const rest = new REST({ version: "10" }).setToken(token);

        if (guildId) {
            console.log(`🎯 Deploying to guild: ${guildId}`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
            console.log("✅ Commands deployed to guild successfully!");
        } else {
            console.log("🌍 Deploying commands globally...");
            await rest.put(Routes.applicationCommands(clientId), { body });
            console.log("✅ Commands deployed globally successfully!");
            console.log("⏰ Note: Global commands may take up to 1 hour to appear in all servers");
        }
    } catch (error) {
        console.error("❌ Failed to deploy commands:", error);
        throw error;
    }
};

export type RegisterCommandsDeps = {
    readonly commands: Commands;
    readonly registerEventHandler: RegisterEventHandler;
};

//Routes InteractionCreate events to the matching command (execute + autocomplete).
export const registerCommands = ({ commands, registerEventHandler }: RegisterCommandsDeps): void => {
    console.log("🔄 Registering commands...");
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
