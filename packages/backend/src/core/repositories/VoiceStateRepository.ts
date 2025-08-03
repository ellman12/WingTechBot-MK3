import type { VoiceConnection } from "@discordjs/voice";
import type { VoiceState } from "discord.js";

export type VoiceStateRepository = {
    readonly getUserVoiceState: (userId: string) => VoiceState | null;
    readonly getChannelVoiceStates: (channelId: string) => VoiceState[];
    readonly getServerVoiceStates: (serverId: string) => VoiceState[];
    readonly getAllActiveVoiceStates: () => VoiceState[];
    readonly isUserInVoiceChannel: (userId: string) => boolean;
    readonly getChannelMemberCount: (channelId: string) => number;

    // Bot Voice Connection Management
    readonly hasBotVoiceConnection: (serverId: string) => boolean;
    readonly getBotVoiceConnection: (serverId: string) => VoiceConnection | undefined;
    readonly getBotConnectedServers: () => string[];
};
