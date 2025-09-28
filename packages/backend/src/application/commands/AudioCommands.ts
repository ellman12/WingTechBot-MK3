import type { SoundService } from "@core/services/SoundService";
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";

import type { Command } from "./Commands.js";

export type AudioCommandDeps = {
    readonly soundService: SoundService;
};

export const createAudioCommands = ({ soundService }: AudioCommandDeps): Record<string, Command> => {
    const addSound: Command = {
        data: new SlashCommandBuilder()
            .setName("add-sound")
            .setDescription("Add a sound to the soundboard")
            .addStringOption(option => option.setName("name").setDescription("Name for the sound").setRequired(true))
            .addAttachmentOption(option => option.setName("file").setDescription("Sound file to add"))
            .addStringOption(option => option.setName("url").setDescription("URL of the sound to add")),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: "This command can only be used in a server!",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const soundName = interaction.options.getString("name")?.trim();

            if (!soundName) {
                await interaction.reply({
                    content: "You must provide a name for the sound.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const urlInput = interaction.options.getString("url");
            const fileInput = interaction.options.getAttachment("file");

            if (urlInput && fileInput) {
                await interaction.reply({
                    content: "You can only provide either a URL or a file attachment, not both.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const url = urlInput ? urlInput.trim() : fileInput?.url;

            if (!url) {
                await interaction.reply({
                    content: "You must provide either a URL or a file attachment.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Send initial response immediately to avoid timeout
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const formattedSoundName = soundName.toLowerCase();

                console.log(`[AudioCommands] Adding sound "${formattedSoundName}" from URL: ${url}`);
                await soundService.addSound(formattedSoundName, url);

                await interaction.editReply({
                    content: `Sound "${soundName}" added successfully!`,
                });
            } catch (error) {
                console.error(`[AudioCommands] Error adding sound "${soundName}":`, error);
                await interaction.editReply({
                    content: `Failed to add sound: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
        },
    };

    const listSounds: Command = {
        data: new SlashCommandBuilder()
            .setName("list-sounds")
            .setDescription("List all sounds in the soundboard")
            .addStringOption(option => option.setName("tag-name").setDescription("List sounds with this tag name").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const tagName = interaction.options.getString("tag-name")?.trim();
            const sounds = await soundService.listSounds(tagName);
            if (sounds.length === 0) {
                await interaction.reply({
                    content: tagName ? `No sounds with tag "${tagName}" found in the soundboard` : "No sounds found in the soundboard.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await interaction.reply({
                content: `Available sounds:\n${sounds.map(sound => `- ${sound}`).join("\n")}`,
                flags: MessageFlags.Ephemeral,
            });
        },
    };

    const deleteSound: Command = {
        data: new SlashCommandBuilder()
            .setName("delete-sound")
            .setDescription("Delete a sound from the soundboard")
            .addStringOption(option => option.setName("name").setDescription("Name of the sound to delete").setRequired(true)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            const soundName = interaction.options.getString("name")?.trim();

            if (!soundName) {
                await interaction.reply({
                    content: "You must provide the name of the sound to delete.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const formattedSoundName = soundName.toLowerCase();

            try {
                await soundService.deleteSound(formattedSoundName);
                await interaction.reply({
                    content: `Sound "${soundName}" deleted successfully!`,
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                await interaction.reply({
                    content: `Failed to delete sound: ${error instanceof Error ? error.message : "Unknown error"}`,
                    flags: MessageFlags.Ephemeral,
                });
            }
        },
    };

    return {
        "add-sound": addSound,
        "list-sounds": listSounds,
        "delete-sound": deleteSound,
    };
};
