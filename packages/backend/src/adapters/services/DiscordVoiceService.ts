import type { SoundService } from "@core/services/SoundService.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { type AudioPlayer, AudioPlayerStatus, type AudioResource, NoSubscriberBehavior, StreamType, type VoiceConnection, VoiceConnectionStatus, createAudioPlayer, createAudioResource, joinVoiceChannel } from "@discordjs/voice";
import type { Client, VoiceChannel as DiscordVoiceChannel } from "discord.js";
import { Readable } from "stream";

export type DiscordVoiceServiceDeps = {
    readonly client: Client;
    readonly soundService: SoundService;
};

type VoiceState = {
    connection: VoiceConnection;
    player: AudioPlayer;
    currentResource?: AudioResource;
    volume: number;
    isPlaying: boolean;
    isReady: boolean;
};

export const createDiscordVoiceService = ({ client, soundService }: DiscordVoiceServiceDeps): VoiceService => {
    const voiceStates = new Map<string, VoiceState>();

    const audioStreamToResource = (stream: Readable): AudioResource => {
        console.log(`[DiscordVoiceService] Creating audio resource with OggOpus format`);
        return createAudioResource(stream, {
            inputType: StreamType.OggOpus,
        });
    };

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

            console.log(`[DiscordVoiceService] Creating audio player`);
            const player: AudioPlayer = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });
            console.log(`[DiscordVoiceService] Audio player created`);

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

            console.log(`[DiscordVoiceService] Storing voice state for server ${serverId}`);
            voiceStates.set(serverId, {
                connection,
                player,
                volume: 100,
                isPlaying: false,
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

    const playAudio = async (serverId: string, nameOrSource: string): Promise<void> => {
        console.log(`[DiscordVoiceService] playAudio called with serverId: ${serverId}, source: ${nameOrSource}`);

        const state = voiceStates.get(serverId);
        if (!state) {
            const error = new Error("Not connected to voice channel");
            console.error(`[DiscordVoiceService] ${error.message} for server ${serverId}`);
            throw error;
        }

        console.log(`[DiscordVoiceService] Voice state found for server ${serverId}:`, {
            volume: state.volume,
            isPlaying: state.isPlaying,
            isReady: state.isReady,
            playerStatus: state.player.state.status,
            connectionStatus: state.connection.state.status,
        });

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
            console.log(`[VOICE SERVICE] Creating audio resource for source: ${nameOrSource}`);
            console.log(`[VOICE SERVICE] Server ID: ${serverId}`);
            console.log(`[VOICE SERVICE] Current player status: ${state.player.state.status}`);
            console.log(`[VOICE SERVICE] Connection ready: ${state.isReady}`);

            // Use AudioFetcher to handle all audio sources
            console.log(`[DiscordVoiceService] Calling soundService.getSound for: ${nameOrSource}`);
            const audioStream = await soundService.getSound(nameOrSource);
            console.log(`[DiscordVoiceService] Got audio stream from soundService`);

            console.log(`[DiscordVoiceService] Converting stream to Discord audio resource`);

            // Add stream debugging
            let bytesReceived = 0;
            audioStream.on("data", chunk => {
                bytesReceived += chunk.length;
                console.log(`[DiscordVoiceService] Received ${chunk.length} bytes, total: ${bytesReceived}`);
            });

            audioStream.on("end", () => {
                console.log(`[DiscordVoiceService] Audio stream ended, total bytes: ${bytesReceived}`);
            });

            audioStream.on("error", error => {
                console.error(`[DiscordVoiceService] Audio stream error:`, error);
            });

            audioStream.on("close", () => {
                console.log(`[DiscordVoiceService] Audio stream closed`);
            });

            const resource = audioStreamToResource(audioStream);

            console.log(`[VOICE SERVICE] Audio resource created successfully`);
            console.log(`[VOICE SERVICE] Resource metadata:`, resource.metadata);
            console.log(`[VOICE SERVICE] Resource volume available:`, !!resource.volume);
            console.log(`[VOICE SERVICE] Resource readable:`, resource.readable);
            console.log(`[VOICE SERVICE] Resource playStream available:`, !!resource.playStream);

            // Add resource stream debugging
            if (resource.playStream) {
                resource.playStream.on("end", () => {
                    console.log(`[DiscordVoiceService] Resource playStream ended`);
                });

                resource.playStream.on("error", error => {
                    console.error(`[DiscordVoiceService] Resource playStream error:`, error);
                });

                resource.playStream.on("close", () => {
                    console.log(`[DiscordVoiceService] Resource playStream closed`);
                });
            }

            if (resource.volume) {
                console.log(`[VOICE SERVICE] Setting volume to ${state.volume / 100}`);
                resource.volume.setVolume(state.volume / 100);
                console.log(`[VOICE SERVICE] Volume set successfully`);
            } else {
                console.log(`[VOICE SERVICE] No volume control available on resource`);
            }

            console.log(`[VOICE SERVICE] Playing audio resource...`);

            state.player.play(resource);
            state.currentResource = resource;
            state.isPlaying = true;

            console.log(`[VOICE SERVICE] Audio resource queued for playback`);
            console.log(`[VOICE SERVICE] Player status after play: ${state.player.state.status}`);

            // Set up a timeout to detect if the stream doesn't start playing
            if (nameOrSource.startsWith("http://") || nameOrSource.startsWith("https://")) {
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
                audioSource: nameOrSource,
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
