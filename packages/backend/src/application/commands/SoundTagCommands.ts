import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { SoundTagService } from "@core/services/SoundTagService.js";
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";

import type { Command } from "./Commands.js";

export type SoundTagCommandDeps = {
    readonly soundTagService: SoundTagService;
    readonly discordChatService: DiscordChatService;
    readonly commandChoicesService: CommandChoicesService;
};

export const createSoundTagCommands = ({ soundTagService, discordChatService, commandChoicesService }: SoundTagCommandDeps): Record<string, Command> => {
    const tagSound: Command = {
        data: new SlashCommandBuilder()
            .setName("tag-sound")
            .setDescription("Adds a tag to a soundboard sound")
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound").setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName("tag-name").setDescription("The name of the tag").setRequired(true).setAutocomplete(true)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const soundName = interaction.options.getString("sound-name")?.trim().toLowerCase();
            const tagName = interaction.options.getString("tag-name")?.trim().toLowerCase();

            if (!soundName) throw new Error("Missing sound name");
            if (!tagName) throw new Error("Missing tag name");

            await soundTagService.addTagToSound(soundName, tagName);
            await interaction.reply(`Added tag "${tagName}" to "${soundName}"`);
        },
        getAutocompleteChoices: commandChoicesService.getAutocompleteChoices,
    };

    const untagSound: Command = {
        data: new SlashCommandBuilder()
            .setName("untag-sound")
            .setDescription("Removes a tag from a soundboard sound")
            .addStringOption(option => option.setName("sound-name").setDescription("The name of the sound").setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName("tag-name").setDescription("The name of the tag").setRequired(true).setAutocomplete(true)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const soundName = interaction.options.getString("sound-name")?.trim().toLowerCase();
            const tagName = interaction.options.getString("tag-name")?.trim().toLowerCase();

            if (!soundName) throw new Error("Missing sound name");
            if (!tagName) throw new Error("Missing tag name");

            await soundTagService.removeTagFromSound(soundName, tagName);
            await interaction.reply(`Removed tag "${tagName}" from "${soundName}"`);
        },
        getAutocompleteChoices: commandChoicesService.getAutocompleteChoices,
    };

    const listTags: Command = {
        data: new SlashCommandBuilder().setName("list-tags").setDescription("List all tags in the soundboard"),

        execute: async (interaction: ChatInputCommandInteraction) => {
            const tags = await soundTagService.listTags();
            if (tags.length === 0) {
                await interaction.reply({ content: "No tags found in the soundboard.", flags: MessageFlags.Ephemeral });
                return;
            }

            const response = `Available tags:\n${tags.map(tag => `- ${tag.name}`).join("\n")}`;
            await discordChatService.replyToInteraction(interaction, response, true);
        },
    };

    return {
        "tag-sound": tagSound,
        "untag-sound": untagSound,
        "list-tags": listTags,
    };
};
