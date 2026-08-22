import type { PlayedSoundSource } from "@core/entities/PlayedSounds.js";

//Voice playback capability. Servers and channels are plain Discord ids; the adapter resolves them.
export type VoiceService = {
    readonly connect: (serverId: string, channelId: string) => Promise<void>;
    readonly disconnect: (serverId: string) => Promise<void>;
    readonly isConnected: (serverId: string) => boolean;
    //The channel the bot is currently in for this server, or null when not connected.
    readonly getVoiceChannelId: (serverId: string) => string | null;
    readonly playAudio: (serverId: string, nameOrSource: string, userId: string, playedSoundSource: PlayedSoundSource, volume?: number) => Promise<string | null>;
    readonly stopAudio: (serverId: string) => Promise<void>;
    readonly stopAudioById: (serverId: string, audioId: string) => Promise<boolean>;
    readonly stopAllAudio: (serverId: string) => Promise<void>;
    readonly isPlaying: (serverId: string) => boolean;
    readonly getActiveAudioCount: (serverId: string) => number;
    readonly getActiveAudioIds: (serverId: string) => string[];
    readonly getVolume: (serverId: string) => number;
    readonly setVolume: (serverId: string, volume: number) => Promise<void>;
    readonly pause: (serverId: string) => Promise<void>;
    readonly resume: (serverId: string) => Promise<void>;
};
