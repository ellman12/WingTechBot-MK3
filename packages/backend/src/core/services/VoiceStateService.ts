import type { VoiceState } from "discord.js";

import type { VoiceStateRepository } from "../repositories/VoiceStateRepository.js";

export type VoiceStateService = {
    getUserVoiceState(userId: string): VoiceState | null;
    isUserInVoiceChannel(userId: string): boolean;
    getUsersInChannel(channelId: string): VoiceState[];
    getUsersInServer(serverId: string): VoiceState[];
    getChannelMemberCount(channelId: string): number;
    isUserMuted(userId: string): boolean;
    isUserDeafened(userId: string): boolean;
    isUserStreaming(userId: string): boolean;
    isUserVideoEnabled(userId: string): boolean;
    getMutedUsersInServer(serverId: string): VoiceState[];
    getStreamingUsersInServer(serverId: string): VoiceState[];
    getVideoEnabledUsersInServer(serverId: string): VoiceState[];
    getDeafenedUsersInServer(serverId: string): VoiceState[];
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
