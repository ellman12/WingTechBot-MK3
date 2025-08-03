import type { SoundService } from "@core/services/SoundService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { ChannelType, ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";

import type { Command } from "./Commands.js";

export type VoiceCommandDeps = {
    readonly voiceService: VoiceService;
    readonly soundService: SoundService;
};

export const createVoiceCommands = ({ voiceService, soundService }: VoiceCommandDeps): Record<string, Command> => {
    const joinCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("join")
            .setDescription("Join a voice channel")
            .addChannelOption(option => option.setName("channel").setDescription("The voice channel to join").setRequired(false).addChannelTypes(ChannelType.GuildVoice)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            console.log(`[VoiceCommands] Join command received from user ${interaction.user.username} in guild ${interaction.guildId}`);

            if (!interaction.guildId) {
                console.log(`[VoiceCommands] Join command rejected - not in guild`);
                await interaction.reply({
                    content: "This command can only be used in a server!",
                    ephemeral: true,
                });
                return;
            }

            try {
                const channel = interaction.options.getChannel("channel");
                let targetChannelId: string;

                console.log(
                    `[VoiceCommands] Join command channel option:`,
                    channel
                        ? {
                              id: channel.id,
                              name: channel.name,
                          }
                        : "none"
                );

                if (channel) {
                    targetChannelId = channel.id;
                    console.log(`[VoiceCommands] Using specified channel: ${channel.name} (${targetChannelId})`);
                } else {
                    const voiceChannel = (interaction.member as GuildMember).voice.channel;
                    console.log(
                        `[VoiceCommands] User voice channel:`,
                        voiceChannel
                            ? {
                                  id: voiceChannel.id,
                                  name: voiceChannel.name,
                              }
                            : "none"
                    );

                    if (voiceChannel) {
                        targetChannelId = voiceChannel.id;
                        console.log(`[VoiceCommands] Using user's voice channel: ${voiceChannel.name} (${targetChannelId})`);
                    } else {
                        console.log(`[VoiceCommands] Join command rejected - user not in voice channel and no channel specified`);
                        await interaction.reply({
                            content: "You are not in a voice channel and no channel was specified!",
                            ephemeral: true,
                        });
                        return;
                    }
                }

                const isAlreadyConnected = voiceService.isConnected(interaction.guildId);
                console.log(`[VoiceCommands] Bot already connected to guild ${interaction.guildId}: ${isAlreadyConnected}`);

                if (isAlreadyConnected) {
                    console.log(`[VoiceCommands] Join command rejected - already connected`);
                    await interaction.reply({
                        content: "I'm already connected to a voice channel in this server!",
                        ephemeral: true,
                    });
                    return;
                }

                console.log(`[VoiceCommands] Attempting to connect to channel ${targetChannelId} in guild ${interaction.guildId}`);
                await voiceService.connect(targetChannelId, interaction.guildId);
                console.log(`[VoiceCommands] Successfully connected to voice channel`);

                const channelName = channel?.name || (interaction.member as GuildMember).voice.channel?.name;
                const responseMessage = `🎵 Joined ${channelName}!`;
                console.log(`[VoiceCommands] Sending success response: ${responseMessage}`);
                await interaction.reply(responseMessage);
            } catch (error) {
                console.error(`[VoiceCommands] Error joining voice channel in guild ${interaction.guildId}:`, error);
                console.error(`[VoiceCommands] Error details:`, {
                    message: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                });

                await interaction.reply({
                    content: `Failed to join the voice channel: ${error instanceof Error ? error.message : "Unknown error"}`,
                    ephemeral: true,
                });
            }
        },
    };

    const leaveCommand: Command = {
        data: new SlashCommandBuilder().setName("leave").setDescription("Leave the current voice channel"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: "This command can only be used in a server!",
                    ephemeral: true,
                });
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
            .addIntegerOption(option => option.setName("volume").setDescription("Volume level (0-100)").setRequired(false).setMinValue(0).setMaxValue(100)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            console.log(`[VoiceCommands] Play command received from user ${interaction.user.username} in guild ${interaction.guildId}`);

            if (!interaction.guildId) {
                console.log(`[VoiceCommands] Play command rejected - not in guild`);
                await interaction.reply({
                    content: "This command can only be used in a server!",
                    ephemeral: true,
                });
                return;
            }

            try {
                const audioSource = interaction.options.getString("source", true);
                const volume = interaction.options.getInteger("volume");

                console.log(`[VoiceCommands] Play command parameters:`, {
                    guildId: interaction.guildId,
                    audioSource,
                    volume,
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });

                const isConnected = voiceService.isConnected(interaction.guildId);
                console.log(`[VoiceCommands] Voice service connection status for guild ${interaction.guildId}: ${isConnected}`);

                if (!isConnected) {
                    const voiceChannel = (interaction.member as GuildMember).voice.channel;
                    console.log(
                        `[VoiceCommands] User voice channel:`,
                        voiceChannel
                            ? {
                                  id: voiceChannel.id,
                                  name: voiceChannel.name,
                              }
                            : "none"
                    );

                    if (!voiceChannel) {
                        console.log(`[VoiceCommands] Play command rejected - bot not connected to voice channel`);
                        await interaction.reply({
                            content: "I'm not connected to a voice channel!",
                            ephemeral: true,
                        });
                        return;
                    }

                    await voiceService.connect(voiceChannel.id, interaction.guildId);
                }

                // Send deferred reply immediately to avoid timeout
                console.log(`[VoiceCommands] Deferring reply to avoid timeout`);
                await interaction.deferReply();

                // Set volume if specified
                if (volume !== null) {
                    console.log(`[VoiceCommands] Setting volume to ${volume}% for guild ${interaction.guildId}`);
                    await voiceService.setVolume(interaction.guildId, volume);
                    console.log(`[VoiceCommands] Volume set successfully`);
                }

                console.log(`[VoiceCommands] Starting audio playback for source: ${audioSource}`);
                // Convert volume from 0-100 scale to 0-1 scale
                const normalizedVolume = volume !== null ? volume / 100 : undefined;
                const audioId = await voiceService.playAudio(interaction.guildId, audioSource, normalizedVolume);
                console.log(`[VoiceCommands] Audio playback started successfully with ID: ${audioId}`);

                const activeCount = voiceService.getActiveAudioCount(interaction.guildId);
                const responseMessage = `🎵 Added audio from: ${audioSource} (ID: ${audioId.substring(0, 8)}, Active: ${activeCount})`;
                console.log(`[VoiceCommands] Sending success response: ${responseMessage}`);
                await interaction.editReply(responseMessage);
            } catch (error) {
                console.error(`[VoiceCommands] Error playing audio in guild ${interaction.guildId}:`, error);
                console.error(`[VoiceCommands] Error details:`, {
                    message: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                });

                // Check if we've already deferred the reply
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: `Failed to play audio: ${error instanceof Error ? error.message : "Unknown error"}`,
                    });
                } else {
                    await interaction.reply({
                        content: `Failed to play audio: ${error instanceof Error ? error.message : "Unknown error"}`,
                        ephemeral: true,
                    });
                }
            }
        },
    };

    const stopCommand: Command = {
        data: new SlashCommandBuilder().setName("stop").setDescription("Stop audio playback"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({
                    content: "This command can only be used in a server!",
                    ephemeral: true,
                });
                return;
            }

            try {
                await voiceService.stopAudio(interaction.guildId);
                await interaction.reply("⏹️ Stopped audio playback!");
            } catch (error) {
                console.error("Error stopping audio:", error);
                await interaction.reply({
                    content: "Failed to stop audio. Please try again.",
                    ephemeral: true,
                });
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
                await interaction.reply({
                    content: "This command can only be used in a server!",
                    ephemeral: true,
                });
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
                await interaction.reply({
                    content: "Failed to set/get volume. Please try again.",
                    ephemeral: true,
                });
            }
        },
    };

    const playDlCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("play-dl")
            .setDescription("Download and automatically play audio from a URL")
            .addStringOption(option => option.setName("url").setDescription("URL of the audio to download and play").setRequired(true))
            .addIntegerOption(option => option.setName("volume").setDescription("Volume level (0-100)").setRequired(false).setMinValue(0).setMaxValue(100)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            console.log(`[VoiceCommands] Play-dl command received from user ${interaction.user.username} in guild ${interaction.guildId}`);

            if (!interaction.guildId) {
                console.log(`[VoiceCommands] Play-dl command rejected - not in guild`);
                await interaction.reply({
                    content: "This command can only be used in a server!",
                    ephemeral: true,
                });
                return;
            }

            try {
                const url = interaction.options.getString("url", true);
                const volume = interaction.options.getInteger("volume");

                console.log(`[VoiceCommands] Play-dl command parameters:`, {
                    guildId: interaction.guildId,
                    url,
                    volume,
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });

                // Check voice connection
                const isConnected = voiceService.isConnected(interaction.guildId);
                console.log(`[VoiceCommands] Voice service connection status for guild ${interaction.guildId}: ${isConnected}`);

                if (!isConnected) {
                    const voiceChannel = (interaction.member as GuildMember).voice.channel;
                    console.log(
                        `[VoiceCommands] User voice channel:`,
                        voiceChannel
                            ? {
                                  id: voiceChannel.id,
                                  name: voiceChannel.name,
                              }
                            : "none"
                    );

                    if (!voiceChannel) {
                        console.log(`[VoiceCommands] Play-dl command rejected - bot not connected to voice channel`);
                        await interaction.reply({
                            content: "I'm not connected to a voice channel! Please join a voice channel first.",
                            ephemeral: true,
                        });
                        return;
                    }

                    await voiceService.connect(voiceChannel.id, interaction.guildId);
                }

                // Send deferred reply immediately to avoid timeout
                console.log(`[VoiceCommands] Deferring reply to avoid timeout`);
                await interaction.deferReply();

                try {
                    // First, download and add the sound with the name "currently-playing"
                    console.log(`[VoiceCommands] Adding sound as "currently-playing" from URL: ${url}`);
                    await soundService.addSound("currently-playing", url);
                    console.log(`[VoiceCommands] Successfully downloaded audio as "currently-playing"`);

                    // Set volume if specified
                    if (volume !== null) {
                        console.log(`[VoiceCommands] Setting volume to ${volume}% for guild ${interaction.guildId}`);
                        await voiceService.setVolume(interaction.guildId, volume);
                        console.log(`[VoiceCommands] Volume set successfully`);
                    }

                    // Then play the downloaded sound
                    console.log(`[VoiceCommands] Starting playback of "currently-playing"`);
                    // Convert volume from 0-100 scale to 0-1 scale if provided
                    const normalizedVolume = volume !== null ? volume / 100 : undefined;
                    const audioId = await voiceService.playAudio(interaction.guildId, "currently-playing", normalizedVolume);
                    console.log(`[VoiceCommands] Audio playback started successfully with ID: ${audioId}`);

                    const activeCount = voiceService.getActiveAudioCount(interaction.guildId);
                    const responseMessage = `🎵 Downloaded and added audio from: ${url} (ID: ${audioId.substring(0, 8)}, Active: ${activeCount})`;
                    console.log(`[VoiceCommands] Sending success response: ${responseMessage}`);
                    await interaction.editReply(responseMessage);
                } catch (downloadError) {
                    console.error(`[VoiceCommands] Error during download/play process:`, downloadError);
                    await interaction.editReply({
                        content: `Failed to download or play audio: ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`,
                    });
                }
            } catch (error) {
                console.error(`[VoiceCommands] Error in play-dl command for guild ${interaction.guildId}:`, error);
                console.error(`[VoiceCommands] Error details:`, {
                    message: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                });

                // Check if we've already deferred the reply
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: `Failed to execute play-dl command: ${error instanceof Error ? error.message : "Unknown error"}`,
                    });
                } else {
                    await interaction.reply({
                        content: `Failed to execute play-dl command: ${error instanceof Error ? error.message : "Unknown error"}`,
                        ephemeral: true,
                    });
                }
            }
        },
    };

    const listActiveCommand = {
        data: new SlashCommandBuilder().setName("list-active").setDescription("List all currently playing audio streams"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            try {
                if (!interaction.guildId) {
                    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
                    return;
                }

                console.log(`[VoiceCommands] Listing active audio for guild ${interaction.guildId}`);

                if (!voiceService.isConnected(interaction.guildId)) {
                    await interaction.reply({ content: "Bot is not connected to a voice channel.", ephemeral: true });
                    return;
                }

                const activeCount = voiceService.getActiveAudioCount(interaction.guildId);
                const activeIds = voiceService.getActiveAudioIds(interaction.guildId);

                if (activeCount === 0) {
                    await interaction.reply("🔇 No audio currently playing.");
                    return;
                }

                const idList = activeIds.map(id => `• ${id.substring(0, 8)}...`).join("\n");
                const responseMessage = `🎵 **${activeCount} active audio stream${activeCount > 1 ? "s" : ""}:**\n\`\`\`\n${idList}\n\`\`\``;
                await interaction.reply(responseMessage);
            } catch (error) {
                console.error(`[VoiceCommands] Error listing active audio:`, error);
                await interaction.reply({ content: "Failed to list active audio streams.", ephemeral: true });
            }
        },
    };

    const stopByIdCommand = {
        data: new SlashCommandBuilder()
            .setName("stop-id")
            .setDescription("Stop a specific audio stream by ID")
            .addStringOption(option => option.setName("id").setDescription("The audio ID to stop (first 8 characters)").setRequired(true)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            try {
                if (!interaction.guildId) {
                    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
                    return;
                }

                const partialId = interaction.options.getString("id", true);
                console.log(`[VoiceCommands] Stopping audio by partial ID: ${partialId}`);

                if (!voiceService.isConnected(interaction.guildId)) {
                    await interaction.reply({ content: "Bot is not connected to a voice channel.", ephemeral: true });
                    return;
                }

                const activeIds = voiceService.getActiveAudioIds(interaction.guildId);
                const matchingId = activeIds.find(id => id.startsWith(partialId));

                if (!matchingId) {
                    await interaction.reply({ content: `❌ No active audio found with ID starting with: ${partialId}`, ephemeral: true });
                    return;
                }

                const success = await voiceService.stopAudioById(interaction.guildId, matchingId);
                if (success) {
                    const remainingCount = voiceService.getActiveAudioCount(interaction.guildId);
                    await interaction.reply(`🛑 Stopped audio ${partialId}... (${remainingCount} remaining)`);
                } else {
                    await interaction.reply({ content: `❌ Failed to stop audio ${partialId}`, ephemeral: true });
                }
            } catch (error) {
                console.error(`[VoiceCommands] Error stopping audio by ID:`, error);
                await interaction.reply({ content: "Failed to stop audio.", ephemeral: true });
            }
        },
    };

    const stopAllCommand = {
        data: new SlashCommandBuilder().setName("stop-all").setDescription("Stop all currently playing audio streams"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            try {
                if (!interaction.guildId) {
                    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
                    return;
                }

                console.log(`[VoiceCommands] Stopping all audio for guild ${interaction.guildId}`);

                if (!voiceService.isConnected(interaction.guildId)) {
                    await interaction.reply({ content: "Bot is not connected to a voice channel.", ephemeral: true });
                    return;
                }

                const activeCount = voiceService.getActiveAudioCount(interaction.guildId);
                if (activeCount === 0) {
                    await interaction.reply("🔇 No audio currently playing.");
                    return;
                }

                await voiceService.stopAllAudio(interaction.guildId);
                await interaction.reply(`🛑 Stopped all ${activeCount} audio stream${activeCount > 1 ? "s" : ""}.`);
            } catch (error) {
                console.error(`[VoiceCommands] Error stopping all audio:`, error);
                await interaction.reply({ content: "Failed to stop audio.", ephemeral: true });
            }
        },
    };

    return {
        join: joinCommand,
        leave: leaveCommand,
        play: playCommand,
        stop: stopCommand,
        volume: volumeCommand,
        "play-dl": playDlCommand,
        "list-active": listActiveCommand,
        "stop-id": stopByIdCommand,
        "stop-all": stopAllCommand,
    };
};
