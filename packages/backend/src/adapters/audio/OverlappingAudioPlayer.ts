import { PcmMixer, type PcmStreamInfo } from "@core/utils/audio/PcmMixer.js";
import { logger } from "@core/utils/logger.js";
import { AudioPlayer, type AudioPlayerState, AudioPlayerStatus, type AudioResource, NoSubscriberBehavior, StreamType, createAudioResource } from "@discordjs/voice";
import { Readable } from "stream";

import type { PlayingSound } from "../../core/entities/PlayingSound.js";

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

export class OverlappingAudioPlayer extends AudioPlayer {
    private readonly mixer: PcmMixer;
    private readonly playingAudio = new Map<string, PlayingAudioInfo>();
    private mixedResource: AudioResource | null = null;
    private mixerOutput: Readable | null = null;

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

        this.on("stateChange", this.handleStateChange.bind(this));
        this.setupMixerOutput();

        logger.debug(`[OverlappingAudioPlayer] Initialized with mixer`);
    }

    private setupMixerOutput(): void {
        // Clean up previous output stream and resource
        if (this.mixerOutput && !this.mixerOutput.destroyed) {
            this.mixerOutput.destroy();
        }

        // Clean up previous mixer listeners to prevent accumulation
        this.mixer.removeAllListeners("data");
        this.mixer.removeAllListeners("error");

        // Create a readable stream from the mixer output
        const mixerOutput = new Readable({
            read() {
                // Readable interface, actual data comes from mixer
            },
        });

        // Attach fresh listeners to the mixer
        this.mixer.on("data", (chunk: Buffer) => {
            if (!mixerOutput.destroyed) {
                mixerOutput.push(chunk);
            }
        });

        this.mixer.on("error", error => {
            logger.error(`[OverlappingAudioPlayer] Mixer error:`, error);
        });

        // Track the output stream for cleanup on reconnect
        this.mixerOutput = mixerOutput;

        // Create audio resource from mixer output
        this.mixedResource = createAudioResource(mixerOutput, {
            inputType: StreamType.Raw,
            inlineVolume: false, // Volume is handled by the mixer
        });

        // Start playing the mixed output
        super.play(this.mixedResource);
    }

    private handleStateChange(oldState: AudioPlayerState, newState: AudioPlayerState): void {
        logger.debug(`[OverlappingAudioPlayer] State change: ${oldState.status} -> ${newState.status} (${this.playingAudio.size} active streams)`);

        if (newState.status === AudioPlayerStatus.Idle && this.playingAudio.size > 0) {
            // If player goes idle but we still have audio to play
            logger.debug(`[OverlappingAudioPlayer] Player idle but ${this.playingAudio.size} streams active, reconnecting mixer output`);
            this.setupMixerOutput();
        }
    }

    // Add audio source with abort capability
    public addAudioSource(audioSource: PlayingSound): string {
        logger.debug(`[OverlappingAudioPlayer] Adding audio source ${audioSource.id} with volume ${audioSource.volume}`);

        const streamInfo: PcmStreamInfo = {
            id: audioSource.id,
            stream: audioSource.stream,
            volume: audioSource.volume,
            onEnd: () => {
                logger.debug(`[OverlappingAudioPlayer] Audio source ${audioSource.id} finished`);
                this.playingAudio.delete(audioSource.id);
            },
        };

        const success = this.mixer.addStream(streamInfo);
        if (success) {
            this.playingAudio.set(audioSource.id, {
                audioSource,
                startTime: Date.now(),
            });
            logger.debug(`[OverlappingAudioPlayer] Successfully added audio source ${audioSource.id}, total playing: ${this.playingAudio.size}`);

            // If the player is idle when adding new audio, restart the mixer output
            if (this.state.status === AudioPlayerStatus.Idle) {
                logger.debug(`[OverlappingAudioPlayer] Player is idle, restarting mixer output to resume playback`);
                this.setupMixerOutput();
            }
        } else {
            logger.warn(`[OverlappingAudioPlayer] Failed to add audio source ${audioSource.id} to mixer`);
        }

        return audioSource.id;
    }

    public stopAudio(audioId: string): boolean {
        logger.debug(`[OverlappingAudioPlayer] Stopping audio ${audioId}`);

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
        logger.debug(`[OverlappingAudioPlayer] Stopping all audio`);

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

    public getActiveAudioCount(): number {
        return this.playingAudio.size;
    }

    public getActiveAudioIds(): string[] {
        return Array.from(this.playingAudio.keys());
    }

    public getActiveAudioInfo(): PlayingAudioInfo[] {
        return Array.from(this.playingAudio.values());
    }

    public override stop(force?: boolean): boolean {
        logger.debug(`[OverlappingAudioPlayer] Player stop called (force: ${force}) - keeping individual streams active`);
        // Don't stop individual audio streams when the Discord player stops; only stop the underlying player.
        return super.stop(force);
    }

    public override pause(interpolateSilence?: boolean): boolean {
        logger.debug(`[OverlappingAudioPlayer] Pausing player`);
        return super.pause(interpolateSilence);
    }

    public override unpause(): boolean {
        logger.debug(`[OverlappingAudioPlayer] Unpausing player`);
        return super.unpause();
    }
}
