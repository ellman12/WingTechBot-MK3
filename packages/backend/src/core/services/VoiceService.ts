export type VoiceService = {
    readonly connect: (channelId: string, serverId: string) => Promise<void>;
    readonly disconnect: (serverId: string) => Promise<void>;
    readonly isConnected: (serverId: string) => boolean;
    readonly playAudio: (serverId: string, nameOrSource: string, volume?: number) => Promise<string>;
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
