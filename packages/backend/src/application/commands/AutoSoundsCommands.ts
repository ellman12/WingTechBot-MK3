import type { AutoSoundsRepository } from "@adapters/repositories/AutoSoundsRepository";
import type { Command } from "@application/commands/Commands";
import type { SoundRepository } from "@core/repositories/SoundRepository";
import type { AutoSoundType } from "@db/types";
import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";

export type AutoSoundsCommandsDeps = {
    readonly autoSoundsRepository: AutoSoundsRepository;
    readonly soundRepository: SoundRepository;
};

export const createAutoSoundsCommands = ({ autoSoundsRepository, soundRepository }: AutoSoundsCommandsDeps): Record<string, Command> => {
    const assignAutoSound: Command = {
        data: new SlashCommandBuilder()
            .setName("assign-auto-sound")
            .setDescription("Assigns a user an AutoSound for an event")
            .addUserOption(option => option.setName("user").setDescription("The user to assign the sound to").setRequired(true))
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound to assign to").setRequired(true))
            .addStringOption(option => option.setName("event-type").setDescription("The name of the event to listen for").setRequired(true).addChoices({ name: "UserJoin", value: "UserJoin" }, { name: "UserLeave", value: "UserLeave" })),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user")!;
            const soundName = interaction.options.getString("sound-name")!;
            const eventType = interaction.options.getString("event-type")! as AutoSoundType;

            const sound = await soundRepository.getSoundByName(soundName);

            if (!sound) {
                await interaction.reply({ content: `Sound with name "${soundName}" doesn't exist`, flags: MessageFlags.Ephemeral });
                return;
            }

            await autoSoundsRepository.addAutoSound(user.id, sound.id!, eventType);
            await interaction.reply(`Assigned sound "${soundName}" to play for ${user.username} when ${eventType} is fired`);
        },
    };

    const removeAutoSound: Command = {
        data: new SlashCommandBuilder()
            .setName("remove-auto-sound")
            .setDescription("Removes an AutoSound for a user and event")
            .addUserOption(option => option.setName("user").setDescription("The user to assign the sound to").setRequired(true))
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound to assign to").setRequired(true))
            .addStringOption(option => option.setName("event-type").setDescription("The name of the event to listen for").setRequired(true).addChoices({ name: "UserJoin", value: "UserJoin" }, { name: "UserLeave", value: "UserLeave" })),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const user = interaction.options.getUser("user")!;
            const soundName = interaction.options.getString("sound-name")!;
            const eventType = interaction.options.getString("event-type")! as AutoSoundType;

            const sound = await soundRepository.getSoundByName(soundName);

            if (!sound) {
                await interaction.reply({ content: `Sound with name "${soundName}" doesn't exist`, flags: MessageFlags.Ephemeral });
                return;
            }

            const result = await autoSoundsRepository.deleteAutoSound(user.id, sound.id!, eventType);
            if (result) {
                await interaction.reply(`Removed sound "${soundName}" for ${user.username} when ${eventType} is fired`);
            } else {
                await interaction.reply(`AutoSound does not exist for ${soundName}, ${user.username}, ${eventType}`);
            }
        },
    };

    return {
        "assign-auto-sound": assignAutoSound,
        "remove-auto-sound": removeAutoSound,
    };
};
