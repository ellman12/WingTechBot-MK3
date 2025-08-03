import type { VoiceState } from "discord.js";

import type { VoiceStateRepository } from "../repositories/VoiceStateRepository.js";

export type VoiceStateService = {
    readonly getUserVoiceState: (userId: string) => VoiceState | null;
    readonly isUserInVoiceChannel: (userId: string) => boolean;
    readonly getUsersInChannel: (channelId: string) => VoiceState[];
    readonly getUsersInServer: (serverId: string) => VoiceState[];
    readonly getChannelMemberCount: (channelId: string) => number;
    readonly isUserMuted: (userId: string) => boolean;
    readonly isUserDeafened: (userId: string) => boolean;
    readonly isUserStreaming: (userId: string) => boolean;
    readonly isUserVideoEnabled: (userId: string) => boolean;
    readonly getMutedUsersInServer: (serverId: string) => VoiceState[];
    readonly getStreamingUsersInServer: (serverId: string) => VoiceState[];
    readonly getVideoEnabledUsersInServer: (serverId: string) => VoiceState[];
    readonly getDeafenedUsersInServer: (serverId: string) => VoiceState[];
};

export const createVoiceStateService = (voiceStateRepo: VoiceStateRepository): VoiceStateService => {
    return {
        getUserVoiceState: userId => voiceStateRepo.getUserVoiceState(userId),
        isUserInVoiceChannel: userId => voiceStateRepo.isUserInVoiceChannel(userId),
        getUsersInChannel: channelId => voiceStateRepo.getChannelVoiceStates(channelId),
        getUsersInServer: serverId => voiceStateRepo.getServerVoiceStates(serverId),
        getChannelMemberCount: channelId => voiceStateRepo.getChannelMemberCount(channelId),
        isUserMuted: userId => {
            const voiceState = voiceStateRepo.getUserVoiceState(userId);
            return voiceState?.mute ?? false;
        },
        isUserDeafened: userId => {
            const voiceState = voiceStateRepo.getUserVoiceState(userId);
            return voiceState?.deaf ?? false;
        },
        isUserStreaming: userId => {
            const voiceState = voiceStateRepo.getUserVoiceState(userId);
            return voiceState?.streaming ?? false;
        },
        isUserVideoEnabled: userId => {
            const voiceState = voiceStateRepo.getUserVoiceState(userId);
            return voiceState?.selfVideo ?? false;
        },
        getMutedUsersInServer: serverId => voiceStateRepo.getServerVoiceStates(serverId).filter(vs => vs.mute),
        getStreamingUsersInServer: serverId => voiceStateRepo.getServerVoiceStates(serverId).filter(vs => vs.streaming),
        getVideoEnabledUsersInServer: serverId => voiceStateRepo.getServerVoiceStates(serverId).filter(vs => vs.selfVideo),
        getDeafenedUsersInServer: serverId => voiceStateRepo.getServerVoiceStates(serverId).filter(vs => vs.deaf),
    };
};
