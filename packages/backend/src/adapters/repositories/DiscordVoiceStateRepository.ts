import type { VoiceStateRepository } from "@core/repositories/VoiceStateRepository.js";
import { getVoiceConnection } from "@discordjs/voice";
import type { Client, VoiceState } from "discord.js";

export type DiscordVoiceStateRepositoryDeps = {
    readonly client: Client;
};

export const createDiscordVoiceStateRepository = (deps: DiscordVoiceStateRepositoryDeps): VoiceStateRepository => {
    const getUserVoiceState = (userId: string): VoiceState | null => {
        try {
            for (const guild of deps.client.guilds.cache.values()) {
                const voiceState = guild.voiceStates.cache.get(userId);
                if (voiceState?.channel) {
                    return voiceState;
                }
            }
            return null;
        } catch {
            return null;
        }
    };

    const getChannelVoiceStates = (channelId: string): VoiceState[] => {
        try {
            const voiceStates: VoiceState[] = [];

            for (const guild of deps.client.guilds.cache.values()) {
                for (const [_, voiceState] of guild.voiceStates.cache) {
                    if (voiceState.channelId === channelId) {
                        voiceStates.push(voiceState);
                    }
                }
            }

            return voiceStates;
        } catch {
            return [];
        }
    };

    const getServerVoiceStates = (serverId: string): VoiceState[] => {
        try {
            const guild = deps.client.guilds.cache.get(serverId);
            if (!guild) {
                return [];
            }

            const voiceStates: VoiceState[] = [];
            for (const [_, voiceState] of guild.voiceStates.cache) {
                if (voiceState.channel) {
                    voiceStates.push(voiceState);
                }
            }

            return voiceStates;
        } catch {
            return [];
        }
    };

    const getAllActiveVoiceStates = (): VoiceState[] => {
        try {
            const voiceStates: VoiceState[] = [];

            for (const guild of deps.client.guilds.cache.values()) {
                for (const [_, voiceState] of guild.voiceStates.cache) {
                    if (voiceState.channel) {
                        voiceStates.push(voiceState);
                    }
                }
            }

            return voiceStates;
        } catch {
            return [];
        }
    };

    const isUserInVoiceChannel = (userId: string): boolean => {
        return getUserVoiceState(userId) !== null;
    };

    const getChannelMemberCount = (channelId: string): number => {
        return getChannelVoiceStates(channelId).length;
    };

    // Bot Voice Connection Management
    const hasBotVoiceConnection = (serverId: string): boolean => {
        const connection = getVoiceConnection(serverId);
        return connection !== undefined;
    };

    const getBotVoiceConnection = (serverId: string) => {
        return getVoiceConnection(serverId);
    };

    const getBotConnectedServers = (): string[] => {
        const connectedServers: string[] = [];

        for (const guild of deps.client.guilds.cache.values()) {
            if (hasBotVoiceConnection(guild.id)) {
                connectedServers.push(guild.id);
            }
        }

        return connectedServers;
    };

    return {
        getUserVoiceState,
        getChannelVoiceStates,
        getServerVoiceStates,
        getAllActiveVoiceStates,
        isUserInVoiceChannel,
        getChannelMemberCount,
        hasBotVoiceConnection,
        getBotVoiceConnection,
        getBotConnectedServers,
    };
};
