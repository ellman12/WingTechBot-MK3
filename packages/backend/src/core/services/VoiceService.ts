export type VoiceService = {
    connect(channelId: string, serverId: string): Promise<void>;
    disconnect(serverId: string): Promise<void>;
    isConnected(serverId: string): boolean;
    playAudio(serverId: string, audioSource: string): Promise<void>;
    stopAudio(serverId: string): Promise<void>;
    isPlaying(serverId: string): boolean;
    getVolume(serverId: string): number;
    setVolume(serverId: string, volume: number): Promise<void>;
    pause(serverId: string): Promise<void>;
    resume(serverId: string): Promise<void>;
};
