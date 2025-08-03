import { OverlappingAudioPlayer } from "@adapters/audio/OverlappingAudioPlayer.js";
import type { SoundService } from "@core/services/SoundService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { AudioPlayerStatus, type VoiceConnection, VoiceConnectionStatus, joinVoiceChannel } from "@discordjs/voice";
import type { Client, VoiceChannel as DiscordVoiceChannel } from "discord.js";

import { createPlayingSound } from "../../core/entities/PlayingSound.js";

export type DiscordVoiceServiceDeps = {
    readonly client: Client;
    readonly soundService: SoundService;
};

type VoiceState = {
    connection: VoiceConnection;
    player: OverlappingAudioPlayer;
    volume: number;
    isReady: boolean;
};

export const createDiscordVoiceService = ({ client, soundService }: DiscordVoiceServiceDeps): VoiceService => {
    const voiceStates = new Map<string, VoiceState>();

    // Note: We no longer create AudioResources for individual streams
    // Raw PCM streams are fed directly to the mixer

    const connect = async (channelId: string, serverId: string): Promise<void> => {
        console.log(`[DiscordVoiceService] Attempting to connect to channel ${channelId} in server ${serverId}`);

        try {
            console.log(`[DiscordVoiceService] Fetching guild ${serverId}`);
            const guild = await client.guilds.fetch(serverId);
            console.log(`[DiscordVoiceService] Guild fetched: ${guild.name} (${guild.id})`);

            console.log(`[DiscordVoiceService] Fetching channel ${channelId}`);
            const channel = (await guild.channels.fetch(channelId)) as DiscordVoiceChannel;
            console.log(`[DiscordVoiceService] Channel fetched:`, {
                name: channel?.name,
                id: channel?.id,
                type: channel?.type,
                isVoiceBased: channel?.isVoiceBased(),
            });

            if (!channel || !channel.isVoiceBased()) {
                const error = new Error("Invalid voice channel");
                console.error(`[DiscordVoiceService] ${error.message}`);
                throw error;
            }

            // Disconnect if already connected
            if (voiceStates.has(serverId)) {
                console.log(`[DiscordVoiceService] Already connected to server ${serverId}, disconnecting first`);
                await disconnect(serverId);
            }

            console.log(`[DiscordVoiceService] Creating voice connection`);
            const connection = joinVoiceChannel({
                channelId: channelId,
                guildId: serverId,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });
            console.log(`[DiscordVoiceService] Voice connection created`);

            console.log(`[DiscordVoiceService] Creating overlapping audio player`);
            const player = new OverlappingAudioPlayer({
                sampleRate: 48000,
                channels: 2,
                bitDepth: 16,
                maxConcurrentStreams: 8,
            });
            console.log(`[DiscordVoiceService] Overlapping audio player created`);

            console.log(`[DiscordVoiceService] Subscribing player to connection`);
            connection.subscribe(player);
            console.log(`[DiscordVoiceService] Player subscribed to connection`);

            // Monitor connection state
            connection.on("stateChange", (oldState, newState) => {
                console.log(`[VOICE SERVICE] Voice connection state change in server ${serverId}: ${oldState.status} -> ${newState.status}`);
                const state = voiceStates.get(serverId);
                if (state) {
                    state.isReady = newState.status === VoiceConnectionStatus.Ready;
                }
            });

            connection.on("error", error => {
                console.error(`[VOICE SERVICE] Voice connection error in server ${serverId}:`, error);
            });

            player.on("error", error => {
                console.error(`[VOICE SERVICE] Audio player error in server ${serverId}:`, error);
                console.error(`[VOICE SERVICE] Error details:`, {
                    name: error instanceof Error ? error.name : "Unknown",
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
            });

            // Set up player event handlers
            player.on(AudioPlayerStatus.Playing, () => {
                const state = voiceStates.get(serverId);
                if (state) {
                    console.log(`[VOICE SERVICE] Audio player in server ${serverId} is now playing.`);
                    console.log(`[VOICE SERVICE] Player status: ${player.state.status}`);
                    console.log(`[VOICE SERVICE] Player is now playing.`);
                }
            });

            player.on(AudioPlayerStatus.Idle, () => {
                const state = voiceStates.get(serverId);
                if (state) {
                    console.log(`[VOICE SERVICE] Audio player in server ${serverId} is idle.`);
                    console.log(`[VOICE SERVICE] Player is now idle.`);
                    console.log(`[VOICE SERVICE] Idle reason: ${player.state.status}`);
                }
            });

            player.on(AudioPlayerStatus.Buffering, () => {
                console.log(`[VOICE SERVICE] Audio player in server ${serverId} is buffering.`);
            });

            player.on(AudioPlayerStatus.AutoPaused, () => {
                console.log(`[VOICE SERVICE] Audio player in server ${serverId} auto-paused.`);
            });

            player.on(AudioPlayerStatus.Paused, () => {
                console.log(`[VOICE SERVICE] Audio player in server ${serverId} paused.`);
            });

            console.log(`[DiscordVoiceService] Storing voice state for server ${serverId}`);
            voiceStates.set(serverId, {
                connection,
                player,
                volume: 100,
                isReady: false,
            });
            console.log(`[DiscordVoiceService] Successfully connected to voice channel ${channel.name} in server ${serverId}`);
        } catch (error) {
            console.error(`[DiscordVoiceService] Failed to connect to voice channel:`, error);
            console.error(`[DiscordVoiceService] Error details:`, {
                message: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
                serverId,
                channelId,
            });
            throw new Error(`Failed to connect to voice channel: ${error}`);
        }
    };

    const disconnect = async (serverId: string): Promise<void> => {
        console.log(`[DiscordVoiceService] Attempting to disconnect from server ${serverId}`);
        const state = voiceStates.get(serverId);
        if (state) {
            console.log(`[DiscordVoiceService] Stopping audio player for server ${serverId}`);
            state.player.stop();
            console.log(`[DiscordVoiceService] Destroying voice connection for server ${serverId}`);
            state.connection.destroy();
            console.log(`[DiscordVoiceService] Removing voice state for server ${serverId}`);
            voiceStates.delete(serverId);
            console.log(`[DiscordVoiceService] Successfully disconnected from server ${serverId}`);
        } else {
            console.log(`[DiscordVoiceService] No voice state found for server ${serverId}, already disconnected`);
        }
    };

    const isConnected = (serverId: string): boolean => {
        const connected = voiceStates.has(serverId);
        console.log(`[DiscordVoiceService] Connection status check for server ${serverId}: ${connected}`);
        return connected;
    };

    const playAudio = async (serverId: string, nameOrSource: string, volume: number = 1.0): Promise<string> => {
        console.log(`[DiscordVoiceService] Playing audio: ${nameOrSource} in server ${serverId}`);

        const state = voiceStates.get(serverId);
        if (!state) {
            const error = new Error("Not connected to voice channel");
            console.error(`[DiscordVoiceService] ${error.message} for server ${serverId}`);
            throw error;
        }

        // Wait for connection to be ready
        if (!state.isReady) {
            console.log(`[DiscordVoiceService] Waiting for connection to be ready...`);
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Connection timeout - voice connection not ready after 10 seconds"));
                }, 10000);

                const checkReady = () => {
                    if (state.isReady) {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        setTimeout(checkReady, 100);
                    }
                };
                checkReady();
            });
        }

        try {
            // Create abort controller for the entire operation
            const abortController = new AbortController();
            const audioId = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

            const audioStream = await soundService.getSound(nameOrSource, abortController.signal);
            const audioSource = createPlayingSound(audioId, audioStream, volume, {
                source: nameOrSource,
                server: serverId,
            });

            // Replace the abort controller with our pre-existing one
            Object.defineProperty(audioSource, "abortController", {
                value: abortController,
                writable: false,
            });

            // Add error handling for stream
            audioSource.stream.on("error", error => {
                console.error(`[DiscordVoiceService] Audio stream error:`, error);
                audioSource.abort();
            });

            // Add audio source to the player
            const resultId = state.player.addAudioSource(audioSource);

            console.log(`[DiscordVoiceService] Added audio ${resultId.substring(0, 8)} (${state.player.getActiveAudioCount()} active)`);
            return resultId;
        } catch (error) {
            console.error(`[DiscordVoiceService] Failed to play audio ${nameOrSource}:`, error);
            throw new Error(`Failed to play audio: ${error}`);
        }
    };

    const stopAudio = async (serverId: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state) {
            state.player.stopAll();
        }
    };

    const stopAudioById = async (serverId: string, audioId: string): Promise<boolean> => {
        const state = voiceStates.get(serverId);
        if (state) {
            const success = state.player.stopAudio(audioId);
            return success;
        }
        return false;
    };

    const isPlaying = (serverId: string): boolean => {
        const state = voiceStates.get(serverId);
        return state ? state.player.getActiveAudioCount() > 0 : false;
    };

    const getActiveAudioCount = (serverId: string): number => {
        const state = voiceStates.get(serverId);
        return state?.player.getActiveAudioCount() ?? 0;
    };

    const getActiveAudioIds = (serverId: string): string[] => {
        const state = voiceStates.get(serverId);
        return state?.player.getActiveAudioIds() ?? [];
    };

    const getVolume = (serverId: string): number => {
        const state = voiceStates.get(serverId);
        return state?.volume ?? 100;
    };

    const setVolume = async (serverId: string, volume: number): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state) {
            // Volume should be 0-100 scale for compatibility with commands
            const clampedVolume = Math.max(0, Math.min(100, volume));
            state.volume = clampedVolume;
        }
    };

    const pause = async (serverId: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state && state.player.getActiveAudioCount() > 0) {
            state.player.pause();
        }
    };

    const resume = async (serverId: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state) {
            state.player.unpause();
        }
    };

    return {
        connect,
        disconnect,
        isConnected,
        playAudio,
        stopAudio,
        stopAudioById,
        stopAllAudio: stopAudio, // Alias for compatibility
        isPlaying,
        getActiveAudioCount,
        getActiveAudioIds,
        getVolume,
        setVolume,
        pause,
        resume,
    };
};
