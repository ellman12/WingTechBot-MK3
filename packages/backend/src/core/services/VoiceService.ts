export type VoiceService = {
    readonly connect: (channelId: string, serverId: string) => Promise<void>;
    readonly disconnect: (serverId: string) => Promise<void>;
    readonly isConnected: (serverId: string) => boolean;
    readonly playAudio: (serverId: string, nameOrSource: string) => Promise<void>;
    readonly stopAudio: (serverId: string) => Promise<void>;
    readonly isPlaying: (serverId: string) => boolean;
    readonly getVolume: (serverId: string) => number;
    readonly setVolume: (serverId: string, volume: number) => Promise<void>;
    readonly pause: (serverId: string) => Promise<void>;
    readonly resume: (serverId: string) => Promise<void>;
};
