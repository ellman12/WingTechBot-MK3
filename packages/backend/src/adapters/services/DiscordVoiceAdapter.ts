import type { VoiceService } from "@core/services/VoiceService.js";
import { AudioPlayerStatus, NoSubscriberBehavior, createAudioPlayer, createAudioResource, joinVoiceChannel } from "@discordjs/voice";
import type { AudioPlayer, AudioResource, VoiceConnection } from "@discordjs/voice";
import type { Client, VoiceChannel as DiscordVoiceChannel } from "discord.js";

export type DiscordVoiceAdapterDeps = {
    readonly client: Client;
};

type VoiceState = {
    connection: VoiceConnection;
    player: AudioPlayer;
    currentResource?: AudioResource;
    volume: number;
    isPlaying: boolean;
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

            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play,
                },
            });

            connection.subscribe(player);

            // Set up player event handlers
            player.on(AudioPlayerStatus.Idle, () => {
                const state = voiceStates.get(serverId);
                if (state) {
                    state.isPlaying = false;
                    state.currentResource = undefined;
                }
            });

            player.on(AudioPlayerStatus.Playing, () => {
                const state = voiceStates.get(serverId);
                if (state) {
                    state.isPlaying = true;
                }
            });

            voiceStates.set(serverId, {
                connection,
                player,
                volume: 100,
                isPlaying: false,
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

        try {
            const resource = createAudioResource(audioSource, {
                inlineVolume: true,
            });

            if (resource.volume) {
                resource.volume.setVolume(state.volume / 100);
            }

            state.player.play(resource);
            state.currentResource = resource;
            state.isPlaying = true;
        } catch (error) {
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
