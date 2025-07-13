import type { VoiceConnection } from "@discordjs/voice";
import type { VoiceState } from "discord.js";

export type VoiceStateRepository = {
    getUserVoiceState(userId: string): VoiceState | null;
    getChannelVoiceStates(channelId: string): VoiceState[];
    getServerVoiceStates(serverId: string): VoiceState[];
    getAllActiveVoiceStates(): VoiceState[];
    isUserInVoiceChannel(userId: string): boolean;
    getChannelMemberCount(channelId: string): number;

    // Bot Voice Connection Management
    hasBotVoiceConnection(serverId: string): boolean;
    getBotVoiceConnection(serverId: string): VoiceConnection | undefined;
    getBotConnectedServers(): string[];
};
