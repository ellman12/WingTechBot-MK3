import type { VoiceService } from "@core/services/VoiceService.js";
import type { AudioPlayer, AudioResource, VoiceConnection } from "@discordjs/voice";
import { AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, createAudioPlayer, joinVoiceChannel } from "@discordjs/voice";
import type { Client, VoiceChannel as DiscordVoiceChannel } from "discord.js";

import { AudioFetcher } from "../audio/AudioFetcher.js";
import { type ExtendedAudioResource, setupFFmpegStreamMonitoring } from "../audio/FFmpegAudioAdapter.js";

export type DiscordVoiceAdapterDeps = {
    readonly client: Client;
};

type VoiceState = {
    connection: VoiceConnection;
    player: AudioPlayer;
    currentResource?: AudioResource;
    volume: number;
    isPlaying: boolean;
    isReady: boolean;
};

export const createDiscordVoiceAdapter = (deps: DiscordVoiceAdapterDeps): VoiceService => {
    const voiceStates = new Map<string, VoiceState>();

    const connect = async (channelId: string, serverId: string): Promise<void> => {
        try {
            const guild = await deps.client.guilds.fetch(serverId);
            const channel = (await guild.channels.fetch(channelId)) as DiscordVoiceChannel;

            if (!channel || !channel.isVoiceBased()) {
                throw new Error("Invalid voice channel");
            }

            // Disconnect if already connected
            if (voiceStates.has(serverId)) {
                await disconnect(serverId);
            }

            const connection = joinVoiceChannel({
                channelId: channelId,
                guildId: serverId,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            const player: AudioPlayer = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });

            connection.subscribe(player);

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
                    console.log(`[VOICE SERVICE] Current resource:`, state.currentResource?.metadata);
                    state.isPlaying = true;
                }
            });

            player.on(AudioPlayerStatus.Idle, () => {
                const state = voiceStates.get(serverId);
                if (state) {
                    console.log(`[VOICE SERVICE] Audio player in server ${serverId} is idle.`);
                    console.log(`[VOICE SERVICE] Previous resource:`, state.currentResource?.metadata);
                    console.log(`[VOICE SERVICE] Idle reason: ${player.state.status}`);
                    state.isPlaying = false;
                    state.currentResource = undefined;
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

            voiceStates.set(serverId, {
                connection,
                player,
                volume: 100,
                isPlaying: false,
                isReady: false,
            });
        } catch (error) {
            throw new Error(`Failed to connect to voice channel: ${error}`);
        }
    };

    const disconnect = async (serverId: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state) {
            state.player.stop();
            state.connection.destroy();
            voiceStates.delete(serverId);
        }
    };

    const isConnected = (serverId: string): boolean => {
        return voiceStates.has(serverId);
    };

    const playAudio = async (serverId: string, audioSource: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (!state) {
            throw new Error("Not connected to voice channel");
        }

        // Wait for connection to be ready
        if (!state.isReady) {
            console.log(`[VOICE SERVICE] Connection not ready, waiting...`);
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
            console.log(`[VOICE SERVICE] Connection is now ready`);
        }

        try {
            console.log(`[VOICE SERVICE] Creating audio resource for source: ${audioSource}`);
            console.log(`[VOICE SERVICE] Server ID: ${serverId}`);
            console.log(`[VOICE SERVICE] Current player status: ${state.player.state.status}`);
            console.log(`[VOICE SERVICE] Connection ready: ${state.isReady}`);

            // Use AudioFetcher to handle all audio sources
            const audioSourceConfig = AudioFetcher.createAudioSource(audioSource);
            const resource = await AudioFetcher.fetchAudio(audioSourceConfig);

            console.log(`[VOICE SERVICE] Audio resource created successfully`);
            console.log(`[VOICE SERVICE] Resource metadata:`, resource.metadata);
            console.log(`[VOICE SERVICE] Resource volume available:`, !!resource.volume);

            if (resource.volume) {
                console.log(`[VOICE SERVICE] Setting volume to ${state.volume / 100}`);
                resource.volume.setVolume(state.volume / 100);
                console.log(`[VOICE SERVICE] Volume set successfully`);
            } else {
                console.log(`[VOICE SERVICE] No volume control available on resource`);
            }

            console.log(`[VOICE SERVICE] Playing audio resource...`);

            // Add stream monitoring for remote URLs
            setupFFmpegStreamMonitoring(resource as ExtendedAudioResource, audioSource);

            state.player.play(resource);
            state.currentResource = resource;
            state.isPlaying = true;

            console.log(`[VOICE SERVICE] Audio resource queued for playback`);
            console.log(`[VOICE SERVICE] Player status after play: ${state.player.state.status}`);

            // Set up a timeout to detect if the stream doesn't start playing
            if (audioSource.startsWith("http://") || audioSource.startsWith("https://")) {
                const playTimeout = setTimeout(() => {
                    if (state.player.state.status === "buffering") {
                        console.warn(`[VOICE SERVICE] Remote URL stream is still buffering after 10 seconds - may be an issue with the URL`);
                    }
                }, 10000);

                // Clear timeout when playing starts
                const clearTimeoutOnPlay = () => {
                    clearTimeout(playTimeout);
                    state.player.off(AudioPlayerStatus.Playing, clearTimeoutOnPlay);
                };
                state.player.on(AudioPlayerStatus.Playing, clearTimeoutOnPlay);
            }
        } catch (error) {
            console.error(`[VOICE SERVICE] Error in playAudio:`, error);
            console.error(`[VOICE SERVICE] Error details:`, {
                name: error instanceof Error ? error.name : "Unknown",
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                serverId,
                audioSource,
            });
            throw new Error(`Failed to play audio: ${error}`);
        }
    };

    const stopAudio = async (serverId: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state) {
            state.player.stop();
            state.isPlaying = false;
            state.currentResource = undefined;
        }
    };

    const isPlaying = (serverId: string): boolean => {
        const state = voiceStates.get(serverId);
        return state?.isPlaying ?? false;
    };

    const getVolume = (serverId: string): number => {
        const state = voiceStates.get(serverId);
        return state?.volume ?? 100;
    };

    const setVolume = async (serverId: string, volume: number): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state) {
            const clampedVolume = Math.max(0, Math.min(100, volume));
            state.volume = clampedVolume;

            if (state.currentResource?.volume) {
                state.currentResource.volume.setVolume(clampedVolume / 100);
            }
        }
    };

    const pause = async (serverId: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state && state.isPlaying) {
            state.player.pause();
        }
    };

    const resume = async (serverId: string): Promise<void> => {
        const state = voiceStates.get(serverId);
        if (state && !state.isPlaying) {
            state.player.unpause();
        }
    };

    return {
        connect,
        disconnect,
        isConnected,
        playAudio,
        stopAudio,
        isPlaying,
        getVolume,
        setVolume,
        pause,
        resume,
    };
};
