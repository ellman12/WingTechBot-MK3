import type { VoiceService } from "@core/services/VoiceService.js";
import { ChannelType, ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";

import type { Command } from "./commands.js";

export const createVoiceCommands = (voiceService: VoiceService): Record<string, Command> => {
    const joinCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("join")
            .setDescription("Join a voice channel")
            .addChannelOption(option => option.setName("channel").setDescription("The voice channel to join").setRequired(false).addChannelTypes(ChannelType.GuildVoice)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({ content: "This command can only be used in a server!", ephemeral: true });
                return;
            }

            try {
                const channel = interaction.options.getChannel("channel");
                let targetChannelId: string;

                if (channel) {
                    targetChannelId = channel.id;
                } else {
                    const voiceChannel = (interaction.member as GuildMember).voice.channel;
                    if (voiceChannel) {
                        targetChannelId = voiceChannel.id;
                    } else {
                        await interaction.reply({
                            content: "You are not in a voice channel and no channel was specified!",
                            ephemeral: true,
                        });
                        return;
                    }
                }

                if (voiceService.isConnected(interaction.guildId)) {
                    await interaction.reply({
                        content: "I'm already connected to a voice channel in this server!",
                        ephemeral: true,
                    });
                    return;
                }

                await voiceService.connect(targetChannelId, interaction.guildId);

                const channelName = channel?.name || (interaction.member as GuildMember).voice.channel?.name;
                await interaction.reply(`🎵 Joined ${channelName}!`);
            } catch (error) {
                console.error("Error joining voice channel:", error);
                await interaction.reply({
                    content: "Failed to join the voice channel. Please try again.",
                    ephemeral: true,
                });
            }
        },
    };

    const leaveCommand: Command = {
        data: new SlashCommandBuilder().setName("leave").setDescription("Leave the current voice channel"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({ content: "This command can only be used in a server!", ephemeral: true });
                return;
            }

            try {
                await voiceService.disconnect(interaction.guildId);
                await interaction.reply("👋 Left the voice channel!");
            } catch (error) {
                console.error("Error leaving voice channel:", error);
                await interaction.reply({
                    content: "Failed to leave the voice channel. Please try again.",
                    ephemeral: true,
                });
            }
        },
    };

    const playCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("play")
            .setDescription("Play audio in the voice channel")
            .addStringOption(option => option.setName("source").setDescription("Audio source (URL, file path, or YouTube URL)").setRequired(true))
            .addIntegerOption(option => option.setName("volume").setDescription("Volume level (0-100)").setRequired(false).setMinValue(0).setMaxValue(100))
            .addStringOption(option =>
                option
                    .setName("quality")
                    .setDescription("Audio quality")
                    .setRequired(false)
                    .addChoices({ name: "Lowest", value: "lowest" }, { name: "Low", value: "low" }, { name: "Medium", value: "medium" }, { name: "High", value: "high" }, { name: "Highest", value: "highest" })
            ),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({ content: "This command can only be used in a server!", ephemeral: true });
                return;
            }

            try {
                const audioSource = interaction.options.getString("source", true);
                const volume = interaction.options.getInteger("volume");
                const quality = interaction.options.getString("quality");

                if (!voiceService.isConnected(interaction.guildId)) {
                    await interaction.reply({ content: "I'm not connected to a voice channel!", ephemeral: true });
                    return;
                }

                // Set volume if specified
                if (volume !== null) {
                    await voiceService.setVolume(interaction.guildId, volume);
                }

                await voiceService.playAudio(interaction.guildId, audioSource);

                const qualityText = quality ? ` at ${quality} quality` : "";
                await interaction.reply(`🎵 Playing audio from: ${audioSource}${qualityText}`);
            } catch (error) {
                console.error("Error playing audio:", error);
                await interaction.reply({ content: "Failed to play audio. Please try again.", ephemeral: true });
            }
        },
    };

    const stopCommand: Command = {
        data: new SlashCommandBuilder().setName("stop").setDescription("Stop audio playback"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({ content: "This command can only be used in a server!", ephemeral: true });
                return;
            }

            try {
                await voiceService.stopAudio(interaction.guildId);
                await interaction.reply("⏹️ Stopped audio playback!");
            } catch (error) {
                console.error("Error stopping audio:", error);
                await interaction.reply({ content: "Failed to stop audio. Please try again.", ephemeral: true });
            }
        },
    };

    const volumeCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("volume")
            .setDescription("Set or get the volume")
            .addIntegerOption(option => option.setName("level").setDescription("Volume level (0-100)").setRequired(false).setMinValue(0).setMaxValue(100)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({ content: "This command can only be used in a server!", ephemeral: true });
                return;
            }

            try {
                const volumeLevel = interaction.options.getInteger("level");

                if (volumeLevel !== null) {
                    await voiceService.setVolume(interaction.guildId, volumeLevel);
                    await interaction.reply(`🔊 Volume set to ${volumeLevel}%`);
                } else {
                    const currentVolume = voiceService.getVolume(interaction.guildId);
                    await interaction.reply(`🔊 Current volume: ${currentVolume}%`);
                }
            } catch (error) {
                console.error("Error with volume command:", error);
                await interaction.reply({ content: "Failed to set/get volume. Please try again.", ephemeral: true });
            }
        },
    };

    return {
        join: joinCommand,
        leave: leaveCommand,
        play: playCommand,
        stop: stopCommand,
        volume: volumeCommand,
    };
};
