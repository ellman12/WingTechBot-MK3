import { parseAudioSource } from "@core/services/AudioFetcherService.js";
import type { CommandChoicesService } from "@core/services/CommandChoicesService.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { randomInt } from "@core/utils/probabilityUtils.js";
import { parseTimeSpan } from "@core/utils/timeUtils.js";
import { ChannelType, ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder } from "discord.js";

import type { Command } from "./Commands.js";

export type VoiceCommandDeps = {
    readonly voiceService: VoiceService;
    readonly soundService: SoundService;
    readonly commandChoicesService: CommandChoicesService;
};

export const createVoiceCommands = ({ voiceService, soundService, commandChoicesService }: VoiceCommandDeps): Record<string, Command> => {
    const joinCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("join")
            .setDescription("Join a voice channel")
            .addChannelOption(option => option.setName("channel").setDescription("The voice channel to join").setRequired(false).addChannelTypes(ChannelType.GuildVoice)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            console.log(`[VoiceCommands] Join command received from user ${interaction.user.username} in guild ${interaction.guildId}`);

            if (!interaction.guildId) {
                console.log(`[VoiceCommands] Join command rejected - not in guild`);
                await interaction.reply({ content: "This command can only be used in a server!", flags: MessageFlags.Ephemeral });
                return;
            }

            try {
                const channel = interaction.options.getChannel("channel");
                let targetChannelId: string;

                console.log(`[VoiceCommands] Join command channel option:`, channel ? { id: channel.id, name: channel.name } : "none");

                if (channel) {
                    targetChannelId = channel.id;
                    console.log(`[VoiceCommands] Using specified channel: ${channel.name} (${targetChannelId})`);
                } else {
                    const voiceChannel = (interaction.member as GuildMember).voice.channel;
                    console.log(`[VoiceCommands] User voice channel:`, voiceChannel ? { id: voiceChannel.id, name: voiceChannel.name } : "none");

                    if (voiceChannel) {
                        targetChannelId = voiceChannel.id;
                        console.log(`[VoiceCommands] Using user's voice channel: ${voiceChannel.name} (${targetChannelId})`);
                    } else {
                        console.log(`[VoiceCommands] Join command rejected - user not in voice channel and no channel specified`);
                        await interaction.reply({ content: "You are not in a voice channel and no channel was specified!", flags: MessageFlags.Ephemeral });
                        return;
                    }
                }

                const isAlreadyConnected = voiceService.isConnected(interaction.guildId);
                console.log(`[VoiceCommands] Bot already connected to guild ${interaction.guildId}: ${isAlreadyConnected}`);

                if (isAlreadyConnected) {
                    console.log(`[VoiceCommands] Join command rejected - already connected`);
                    await interaction.reply({ content: "I'm already connected to a voice channel in this server!", flags: MessageFlags.Ephemeral });
                    return;
                }

                console.log(`[VoiceCommands] Attempting to connect to channel ${targetChannelId} in guild ${interaction.guildId}`);
                await voiceService.connect(interaction.guild!, targetChannelId);
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

                await interaction.reply({ content: `Failed to join the voice channel: ${error instanceof Error ? error.message : "Unknown error"}`, flags: MessageFlags.Ephemeral });
            }
        },
    };

    const leaveCommand: Command = {
        data: new SlashCommandBuilder().setName("leave").setDescription("Leave the current voice channel"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({ content: "This command can only be used in a server!", flags: MessageFlags.Ephemeral });
                return;
            }

            try {
                await voiceService.disconnect(interaction.guildId);
                await interaction.reply("👋 Left the voice channel!");
            } catch (error) {
                console.error("Error leaving voice channel:", error);
                await interaction.reply({ content: "Failed to leave the voice channel. Please try again.", flags: MessageFlags.Ephemeral });
            }
        },
    };

    const playCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("play")
            .setDescription("Play audio in the voice channel")
            .addStringOption(option => option.setName("audio-source").setDescription("Audio source (URL, file path, or YouTube URL)").setRequired(true).setAutocomplete(true))
            .addIntegerOption(option => option.setName("volume").setDescription("Volume level (0-100)").setRequired(false).setMinValue(0).setMaxValue(100))
            .addBooleanOption(option => option.setName("preload").setDescription("If we should download fully first (for URLs").setRequired(false))
            .addIntegerOption(option => option.setName("repeat-amount").setDescription("How many times to repeat the sound").setRequired(false).setMinValue(1))
            .addStringOption(option => option.setName("repeat-delay").setDescription("Delay between each sound. Can be a number or a range.").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            console.log(`[VoiceCommands] Play command received from user ${interaction.user.username} in guild ${interaction.guildId}`);

            if (!interaction.guildId) {
                console.log(`[VoiceCommands] Play command rejected - not in guild`);
                await interaction.reply({ content: "This command can only be used in a server!", flags: MessageFlags.Ephemeral });
                return;
            }

            try {
                const options = interaction.options;
                const audioSource = options.getString("audio-source", true);
                const volume = options.getInteger("volume");
                const shouldPreload = options.getBoolean("preload") ?? false;
                const repeatAmount = options.getInteger("repeat-amount") ?? 1;
                const unparsedRepeatDelay = options.getString("repeat-delay") ?? "1 s";
                const { minDelay, maxDelay } = parsePlayCommandRepeatDelay(unparsedRepeatDelay);

                const isPreloading = shouldPreload && parseAudioSource(audioSource) !== "soundboard";
                const soundToPlay = isPreloading ? "currently-playing" : audioSource;

                console.log(`[VoiceCommands] Play command parameters:`, { guildId: interaction.guildId, audioSource, volume, userId: interaction.user.id, username: interaction.user.username });

                const isConnected = voiceService.isConnected(interaction.guildId);
                console.log(`[VoiceCommands] Voice service connection status for guild ${interaction.guildId}: ${isConnected}`);

                if (!isConnected) {
                    const voiceChannel = (interaction.member as GuildMember).voice.channel;
                    console.log(`[VoiceCommands] User voice channel:`, voiceChannel ? { id: voiceChannel.id, name: voiceChannel.name } : "none");

                    if (!voiceChannel) {
                        console.log(`[VoiceCommands] Play command rejected - bot not connected to voice channel`);
                        await interaction.reply({ content: "I'm not connected to a voice channel!", flags: MessageFlags.Ephemeral });
                        return;
                    }

                    await voiceService.connect(interaction.guild!, voiceChannel.id);
                }

                console.log(`[VoiceCommands] Deferring reply to avoid timeout`);
                await interaction.deferReply();

                if (isPreloading) {
                    await soundService.addSound("currently-playing", audioSource);
                }

                if (volume !== null) {
                    console.log(`[VoiceCommands] Setting volume to ${volume}% for guild ${interaction.guildId}`);
                    await voiceService.setVolume(interaction.guildId, volume);
                    console.log(`[VoiceCommands] Volume set successfully`);
                }

                const normalizedVolume = volume !== null ? volume / 100 : undefined;
                const activeCount = voiceService.getActiveAudioCount(interaction.guildId);

                const responseMessage = `🎵 Added audio from: ${audioSource} (Active: ${activeCount})`;
                console.log(`[VoiceCommands] Sending success response: ${responseMessage}`);
                await interaction.editReply(responseMessage);

                if (repeatAmount > 1) {
                    console.log(`[VoiceCommands] Creating premixed repeated sound with ${repeatAmount} repetitions`);

                    const delaysMs: number[] = [0];
                    let currentDelay = 0;

                    for (let i = 1; i < repeatAmount; i++) {
                        const delay = randomInt(minDelay, maxDelay);
                        currentDelay += delay;
                        delaysMs.push(currentDelay);
                    }

                    console.log(`[VoiceCommands] Generated delays: [${delaysMs.join(", ")}]ms`);

                    const repeatedSoundName = await soundService.getRepeatedSound(soundToPlay, delaysMs);

                    console.log(`[VoiceCommands] Playing premixed repeated sound: ${repeatedSoundName}`);
                    await voiceService.playAudio(interaction.guildId, repeatedSoundName, normalizedVolume);
                } else {
                    await voiceService.playAudio(interaction.guildId, soundToPlay, normalizedVolume);
                }
            } catch (error) {
                console.error(`[VoiceCommands] Error playing audio in guild ${interaction.guildId}:`, error);
                console.error(`[VoiceCommands] Error details:`, {
                    message: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                });

                if (interaction.deferred) {
                    await interaction.editReply({ content: `Failed to play audio: ${error instanceof Error ? error.message : "Unknown error"}` });
                } else {
                    await interaction.reply({ content: `Failed to play audio: ${error instanceof Error ? error.message : "Unknown error"}`, flags: MessageFlags.Ephemeral });
                }
            }
        },
        getAutocompleteChoices: commandChoicesService.getAutocompleteChoices,
    };

    //Converts input like "1 second" or "2 min - 10 min" into millisecond values.
    const parsePlayCommandRepeatDelay = (unparsedRepeatDelay: string | null): { minDelay: number; maxDelay: number } => {
        if (!unparsedRepeatDelay) return { minDelay: 0, maxDelay: 0 };

        const matches = unparsedRepeatDelay.match(/^(\d*\s*[a-z]*)\s*-?\s*(\d*\s*[a-z]*)$/i);
        if (!matches) {
            throw new Error("Invalid repeat delay format");
        }

        const minDelay = parseTimeSpan(matches[1]!);
        const maxDelay = matches[2] ? parseTimeSpan(matches[2]) : minDelay;
        return { minDelay, maxDelay };
    };

    const stopCommand: Command = {
        data: new SlashCommandBuilder()
            .setName("stop")
            .setDescription("Stop audio playback (all or specific by ID)")
            .addStringOption(option => option.setName("id").setDescription("Audio ID to stop (e.g., 1, 2, 3). Leave empty to stop all.").setRequired(false)),
        execute: async (interaction: ChatInputCommandInteraction) => {
            if (!interaction.guildId) {
                await interaction.reply({ content: "This command can only be used in a server!", flags: MessageFlags.Ephemeral });
                return;
            }

            try {
                if (!voiceService.isConnected(interaction.guildId)) {
                    await interaction.reply({ content: "Bot is not connected to a voice channel.", flags: MessageFlags.Ephemeral });
                    return;
                }

                const audioId = interaction.options.getString("id");

                if (audioId) {
                    // Stop specific audio by ID
                    console.log(`[VoiceCommands] Stopping audio by partial ID: ${audioId}`);
                    const activeIds = voiceService.getActiveAudioIds(interaction.guildId);
                    const matchingId = activeIds.find(id => id.startsWith(audioId));

                    if (!matchingId) {
                        await interaction.reply({ content: `❌ No active audio found with ID starting with: ${audioId}`, flags: MessageFlags.Ephemeral });
                        return;
                    }

                    const success = await voiceService.stopAudioById(interaction.guildId, matchingId);
                    if (success) {
                        const remainingCount = voiceService.getActiveAudioCount(interaction.guildId);
                        await interaction.reply(`⏹️ Stopped audio ${audioId} (${remainingCount} remaining)`);
                    } else {
                        await interaction.reply({ content: `❌ Failed to stop audio ${audioId}`, flags: MessageFlags.Ephemeral });
                    }
                } else {
                    // Stop all audio
                    const activeCount = voiceService.getActiveAudioCount(interaction.guildId);
                    if (activeCount === 0) {
                        await interaction.reply("🔇 No audio currently playing.");
                        return;
                    }

                    console.log(`[VoiceCommands] Stopping all audio for guild ${interaction.guildId}`);
                    await voiceService.stopAudio(interaction.guildId);
                    await interaction.reply(`⏹️ Stopped all ${activeCount} audio stream${activeCount > 1 ? "s" : ""}!`);
                }
            } catch (error) {
                console.error("Error stopping audio:", error);
                await interaction.reply({ content: "Failed to stop audio. Please try again.", flags: MessageFlags.Ephemeral });
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
                await interaction.reply({ content: "This command can only be used in a server!", flags: MessageFlags.Ephemeral });
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
                await interaction.reply({ content: "Failed to set/get volume. Please try again.", flags: MessageFlags.Ephemeral });
            }
        },
    };

    const listActiveCommand = {
        data: new SlashCommandBuilder().setName("list-active").setDescription("List all currently playing audio streams"),
        execute: async (interaction: ChatInputCommandInteraction) => {
            try {
                if (!interaction.guildId) {
                    await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
                    return;
                }

                console.log(`[VoiceCommands] Listing active audio for guild ${interaction.guildId}`);

                if (!voiceService.isConnected(interaction.guildId)) {
                    await interaction.reply({ content: "Bot is not connected to a voice channel.", flags: MessageFlags.Ephemeral });
                    return;
                }

                const activeCount = voiceService.getActiveAudioCount(interaction.guildId);
                const activeIds = voiceService.getActiveAudioIds(interaction.guildId);

                if (activeCount === 0) {
                    await interaction.reply("🔇 No audio currently playing.");
                    return;
                }

                const idList = activeIds.map(id => `• ${id}`).join("\n");
                const responseMessage = `🎵 **${activeCount} active audio stream${activeCount > 1 ? "s" : ""}:**\n\`\`\`\n${idList}\n\`\`\``;
                await interaction.reply(responseMessage);
            } catch (error) {
                console.error(`[VoiceCommands] Error listing active audio:`, error);
                await interaction.reply({ content: "Failed to list active audio streams.", flags: MessageFlags.Ephemeral });
            }
        },
    };

    return {
        join: joinCommand,
        leave: leaveCommand,
        play: playCommand,
        stop: stopCommand,
        volume: volumeCommand,
        "list-active": listActiveCommand,
    };
};
