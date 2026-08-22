import type { PlayingSound } from "@core/entities/PlayingSound.js";
import { PcmMixer, type PcmStreamInfo } from "@core/utils/audio/PcmMixer.js";
import { AudioPlayer, type AudioPlayerState, type AudioResource, NoSubscriberBehavior, StreamType, createAudioResource } from "@discordjs/voice";

export type OverlappingAudioPlayerOptions = {
    readonly sampleRate?: number;
    readonly channels?: number;
    readonly bitDepth?: number;
    readonly maxConcurrentStreams?: number;
};

export type PlayingAudioInfo = {
    readonly audioSource: PlayingSound;
    readonly startTime: number;
};

// An AudioPlayer backed by a persistent mix bus.
//
// The mixer is a pull-based Readable wrapped directly in a single AudioResource, so the
// player's own 20ms tick drives mixing. The bus emits silence when nothing is playing,
// which keeps the player in the Playing state for its whole lifetime instead of cycling
// through Idle and rebuilding the resource between sounds.
export class OverlappingAudioPlayer extends AudioPlayer {
    private readonly mixer: PcmMixer;
    private readonly playingAudio = new Map<string, PlayingAudioInfo>();
    private readonly mixedResource: AudioResource;
    private readonly onMixerError = (error: Error) => {
        console.error(`[OverlappingAudioPlayer] Mixer error:`, error);
    };
    private isDestroyed = false;

    constructor(options: OverlappingAudioPlayerOptions = {}) {
        super({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
            },
        });

        this.mixer = new PcmMixer({
            sampleRate: options.sampleRate ?? 48000,
            channels: options.channels ?? 2,
            bitDepth: options.bitDepth ?? 16,
            maxConcurrentStreams: options.maxConcurrentStreams ?? 8,
        });

        this.mixer.on("error", this.onMixerError);
        this.on("stateChange", this.handleStateChange.bind(this));

        // The mixer is the resource. It never ends, so it is created exactly once.
        this.mixedResource = createAudioResource(this.mixer, {
            inputType: StreamType.Raw,
            inlineVolume: false, // Volume is handled by the mixer
        });
        super.play(this.mixedResource);

        console.log(`[OverlappingAudioPlayer] Initialized with mixer`);
    }

    private handleStateChange(oldState: AudioPlayerState, newState: AudioPlayerState): void {
        console.log(`[OverlappingAudioPlayer] State change: ${oldState.status} -> ${newState.status} (${this.playingAudio.size} active streams)`);
    }

    // Add audio source with abort capability
    public addAudioSource(audioSource: PlayingSound): string {
        console.log(`[OverlappingAudioPlayer] Adding audio source ${audioSource.id} with volume ${audioSource.volume}`);

        const streamInfo: PcmStreamInfo = {
            id: audioSource.id,
            stream: audioSource.stream,
            volume: audioSource.volume,
            onEnd: () => {
                console.log(`[OverlappingAudioPlayer] Audio source ${audioSource.id} finished`);
                this.playingAudio.delete(audioSource.id);
            },
        };

        const success = this.mixer.addStream(streamInfo);
        if (success) {
            this.playingAudio.set(audioSource.id, {
                audioSource,
                startTime: Date.now(),
            });
            console.log(`[OverlappingAudioPlayer] Successfully added audio source ${audioSource.id}, total playing: ${this.playingAudio.size}`);
        } else {
            console.warn(`[OverlappingAudioPlayer] Failed to add audio source ${audioSource.id} to mixer`);
        }

        return audioSource.id;
    }

    public stopAudio(audioId: string): boolean {
        console.log(`[OverlappingAudioPlayer] Stopping audio ${audioId}`);

        // Get the audio info to call abort
        const audioInfo = this.playingAudio.get(audioId);
        if (audioInfo) {
            audioInfo.audioSource.abort();
        }

        const success = this.mixer.removeStream(audioId);
        if (success) {
            this.playingAudio.delete(audioId);
        }
        return success;
    }

    public stopAll(): void {
        console.log(`[OverlappingAudioPlayer] Stopping all audio`);

        // Abort all audio sources
        for (const audioInfo of this.playingAudio.values()) {
            audioInfo.audioSource.abort();
        }

        const audioIds = Array.from(this.playingAudio.keys());
        for (const audioId of audioIds) {
            this.mixer.removeStream(audioId);
            this.playingAudio.delete(audioId);
        }
    }

    // Sets the volume of every currently-playing source (1.0 = 100%, 2.0 = 200%)
    public setVolume(volume: number): void {
        this.mixer.setAllStreamVolumes(volume);
    }

    // Sets the volume of a single playing source
    public setAudioVolume(audioId: string, volume: number): boolean {
        return this.mixer.setStreamVolume(audioId, volume);
    }

    public getActiveAudioCount(): number {
        return this.playingAudio.size;
    }

    public getActiveAudioIds(): string[] {
        return Array.from(this.playingAudio.keys());
    }

    public getActiveAudioInfo(): PlayingAudioInfo[] {
        return Array.from(this.playingAudio.values());
    }

    // Tears the player down for good: aborts every source, stops the discord.js player and
    // destroys the mix bus so nothing survives a disconnect. Safe to call more than once.
    public destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        console.log(`[OverlappingAudioPlayer] Destroying player (${this.playingAudio.size} active streams)`);

        this.stopAll();
        super.stop(true);

        this.mixer.removeListener("error", this.onMixerError);
        if (!this.mixer.destroyed) {
            this.mixer.destroy();
        }
        this.mixer.removeAllListeners();

        this.removeAllListeners();
    }

    public override stop(force?: boolean): boolean {
        console.log(`[OverlappingAudioPlayer] Player stop called (force: ${force}) - but keeping individual streams active`);
        // Don't stop individual audio streams when Discord player stops
        // Only stop the underlying Discord player
        return super.stop(force);
    }

    public override pause(interpolateSilence?: boolean): boolean {
        console.log(`[OverlappingAudioPlayer] Pausing player`);
        return super.pause(interpolateSilence);
    }

    public override unpause(): boolean {
        console.log(`[OverlappingAudioPlayer] Unpausing player`);
        return super.unpause();
    }
}
