import { AudioPlayer, AudioPlayerStatus, type AudioPlayerState, type AudioResource, NoSubscriberBehavior, StreamType, createAudioResource } from "@discordjs/voice";
import { Readable } from "stream";
import { PcmMixer, type PcmStreamInfo } from "./PcmMixer.js";
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
    private nextAudioId = 0;

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

        console.log(`[OverlappingAudioPlayer] Initialized with mixer`);
    }

    private setupMixerOutput(): void {
        // Create a readable stream from the mixer output
        const mixerOutput = new Readable({
            read() {
                // Readable interface, actual data comes from mixer
            },
        });

        // Pipe mixer to our readable stream
        this.mixer.on("data", (chunk: Buffer) => {
            mixerOutput.push(chunk);
        });

        this.mixer.on("end", () => {
            mixerOutput.push(null);
        });

        this.mixer.on("error", (error) => {
            console.error(`[OverlappingAudioPlayer] Mixer error:`, error);
            mixerOutput.destroy(error);
        });

        // Create audio resource from mixer output
        this.mixedResource = createAudioResource(mixerOutput, {
            inputType: StreamType.Raw,
            inlineVolume: false, // Volume is handled by the mixer
        });

        // Start playing the mixed output
        super.play(this.mixedResource);
    }

    private handleStateChange(oldState: AudioPlayerState, newState: AudioPlayerState): void {
        console.log(`[OverlappingAudioPlayer] State change: ${oldState.status} -> ${newState.status} (${this.playingAudio.size} active streams)`);
        
        if (newState.status === AudioPlayerStatus.Idle && this.playingAudio.size > 0) {
            // If player goes idle but we still have audio to play, restart the mixed resource
            console.log(`[OverlappingAudioPlayer] Player idle but ${this.playingAudio.size} streams active, restarting mixed resource`);
            // Small delay to ensure streams are ready
            setTimeout(() => {
                if (this.playingAudio.size > 0) {
                    this.setupMixerOutput();
                }
            }, 100);
        }
    }

    public override play(resource: AudioResource, volume: number = 1.0): string {
        const audioId = `audio_${this.nextAudioId++}`;
        console.log(`[OverlappingAudioPlayer] Adding audio ${audioId} with volume ${volume}`);

        // Convert AudioResource to a stream that we can add to the mixer
        const pcmStream = this.extractPcmFromResource(resource);
        
        const streamInfo: PcmStreamInfo = {
            id: audioId,
            stream: pcmStream,
            volume: Math.max(0, Math.min(1, volume)),
            onEnd: () => {
                console.log(`[OverlappingAudioPlayer] Audio ${audioId} finished`);
                this.playingAudio.delete(audioId);
            },
        };

        const success = this.mixer.addStream(streamInfo);
        if (success) {
            // Create a basic AudioSource for compatibility
            const audioSource = {
                id: audioId,
                stream: pcmStream,
                volume: Math.max(0, Math.min(1, volume)),
                abortController: new AbortController(),
                abort: () => {
                    if (!pcmStream.destroyed) {
                        pcmStream.destroy();
                    }
                }
            };
            
            this.playingAudio.set(audioId, {
                audioSource,
                startTime: Date.now(),
            });
            console.log(`[OverlappingAudioPlayer] Successfully added audio ${audioId}, total playing: ${this.playingAudio.size}`);
        } else {
            console.warn(`[OverlappingAudioPlayer] Failed to add audio ${audioId} to mixer`);
        }

        return audioId;
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

    public getActiveAudioCount(): number {
        return this.playingAudio.size;
    }

    public getActiveAudioIds(): string[] {
        return Array.from(this.playingAudio.keys());
    }

    public getActiveAudioInfo(): PlayingAudioInfo[] {
        return Array.from(this.playingAudio.values());
    }


    private extractPcmFromResource(resource: AudioResource): Readable {
        // Since we're now using PCM pipeline, the resource should already contain PCM data
        // We can directly use the playStream from the AudioResource
        if (!resource.playStream) {
            throw new Error("AudioResource does not have a playStream");
        }

        return resource.playStream;
    }

    public override stop(force?: boolean): boolean {
        const stack = new Error().stack;
        console.log(`[OverlappingAudioPlayer] Player stop called (force: ${force}) - but keeping individual streams active`);
        console.log(`[OverlappingAudioPlayer] Stop called from stack trace:`, stack?.split('\n').slice(1, 5).join('\n'));
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
