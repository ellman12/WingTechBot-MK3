import { Readable } from "stream";

import { getSampleByteIndex, mixSamples, readPcmSample, writePcmSample } from "./pcmUtils.js";

export type PcmStreamInfo = {
    readonly id: string;
    readonly stream: NodeJS.ReadableStream;
    readonly volume: number; // 0.0 to 2.0 (1.0 = unity gain)
    readonly onEnd?: () => void;
};

type StreamState = {
    readonly info: PcmStreamInfo;
    volume: number; // mutable so /volume can retarget already-playing streams
    hasEnded: boolean;
    hasStarted: boolean; // cleared until the initial buffer threshold is met
    isPaused: boolean; // true while the source is paused for backpressure
    readonly onData: (chunk: Buffer) => void;
    readonly onStreamEnd: () => void;
    readonly onError: (error: Error) => void;
};

export type PcmMixerOptions = {
    readonly sampleRate: number; // 48000 for Discord
    readonly channels: number; // 2 for stereo
    readonly bitDepth: number; // 16 for signed 16-bit
    readonly maxConcurrentStreams?: number;
    // Per-source ingest watermarks in bytes. Defaults to 2s high / 0.5s low.
    readonly bufferHighWaterMark?: number;
    readonly bufferLowWaterMark?: number;
};

// Mixes any number of raw PCM sources into a single continuous bus.
//
// The mixer is a pull-based Readable: every `_read()` produces exactly one 20ms chunk,
// so the consumer (discord.js' AudioPlayer, via its AudioResource) is the only clock in
// the pipeline. When no source has data ready the mixer emits silence instead of stalling,
// which keeps the bus - and therefore the player - alive between sounds.
export class PcmMixer extends Readable {
    private readonly sampleRate: number;
    private readonly channels: number;
    private readonly bitDepth: number;
    private readonly bytesPerSample: number;
    private readonly maxConcurrentStreams: number;
    private readonly bytesPerChunk: number; // 20ms of audio
    private readonly initialBufferThreshold: number; // Bytes needed before a stream starts mixing
    private readonly bufferHighWaterMark: number; // Pause the source above this
    private readonly bufferLowWaterMark: number; // Resume the source below this

    private activeStreams = new Map<string, StreamState>();
    private streamBuffers = new Map<string, Buffer[]>();
    private streamBufferLengths = new Map<string, number>();

    constructor(options: PcmMixerOptions) {
        const sampleRate = options.sampleRate;
        const bytesPerSample = (options.bitDepth / 8) * options.channels;
        const bytesPerChunk = Math.floor(sampleRate * 0.02) * bytesPerSample;

        super({
            objectMode: false,
            // Read ahead by at most four 20ms chunks so latency stays bounded.
            highWaterMark: bytesPerChunk * 4,
        });

        this.sampleRate = sampleRate;
        this.channels = options.channels;
        this.bitDepth = options.bitDepth;
        this.bytesPerSample = bytesPerSample;
        this.bytesPerChunk = bytesPerChunk;
        this.maxConcurrentStreams = options.maxConcurrentStreams ?? 8;

        // Require 60ms of audio from a source before it joins the mix (3 chunks worth)
        this.initialBufferThreshold = Math.floor(this.sampleRate * 0.06) * this.bytesPerSample;

        // Bound each source's ingest buffer: ~2s high water, ~0.5s low water
        this.bufferHighWaterMark = options.bufferHighWaterMark ?? this.sampleRate * this.bytesPerSample * 2;
        this.bufferLowWaterMark = options.bufferLowWaterMark ?? Math.floor(this.sampleRate * this.bytesPerSample * 0.5);

        console.log(
            `[PcmMixer] Initialized mixer: ${this.sampleRate}Hz, ${this.channels}ch, ${this.bitDepth}-bit, chunk: ${this.bytesPerChunk} bytes, initialThreshold: ${this.initialBufferThreshold} bytes, watermarks: ${this.bufferLowWaterMark}/${this.bufferHighWaterMark} bytes`
        );
    }

    public addStream(streamInfo: PcmStreamInfo): boolean {
        if (this.activeStreams.size >= this.maxConcurrentStreams) {
            console.warn(`[PcmMixer] Maximum concurrent streams (${this.maxConcurrentStreams}) reached`);
            return false;
        }

        if (this.activeStreams.has(streamInfo.id)) {
            console.warn(`[PcmMixer] Stream ${streamInfo.id} already exists`);
            return false;
        }

        console.log(`[PcmMixer] Adding stream: ${streamInfo.id} with volume ${streamInfo.volume}`);

        const onData = (chunk: Buffer) => this.handleStreamData(streamInfo.id, chunk);

        const onStreamEnd = () => {
            console.log(`[PcmMixer] Stream ${streamInfo.id} ended - marking as ended but keeping buffered data`);
            const streamState = this.activeStreams.get(streamInfo.id);
            if (streamState) {
                streamState.hasEnded = true;
            }
            // Don't call onEnd yet - wait until the buffered data has been mixed out
        };

        const onError = (error: Error) => {
            console.error(`[PcmMixer] Stream ${streamInfo.id} error:`, error);
            this.removeStream(streamInfo.id);
        };

        this.activeStreams.set(streamInfo.id, {
            info: streamInfo,
            volume: clampVolume(streamInfo.volume),
            hasEnded: false,
            hasStarted: false,
            isPaused: false,
            onData,
            onStreamEnd,
            onError,
        });
        this.streamBuffers.set(streamInfo.id, []);
        this.streamBufferLengths.set(streamInfo.id, 0);

        streamInfo.stream.on("data", onData);
        streamInfo.stream.on("end", onStreamEnd);
        streamInfo.stream.on("error", onError);

        return true;
    }

    public removeStream(streamId: string): boolean {
        const streamState = this.activeStreams.get(streamId);
        if (!streamState) {
            return false;
        }

        console.log(`[PcmMixer] Force removing stream: ${streamId}`);
        this.detachStream(streamId);
        streamState.info.onEnd?.(); // Call onEnd when force removing

        return true;
    }

    public getActiveStreamCount(): number {
        return this.activeStreams.size;
    }

    public getActiveStreamIds(): string[] {
        return Array.from(this.activeStreams.keys());
    }

    public getStreamVolume(streamId: string): number | null {
        return this.activeStreams.get(streamId)?.volume ?? null;
    }

    // Retargets the volume of an already-playing stream. Takes effect on the next mixed chunk.
    public setStreamVolume(streamId: string, volume: number): boolean {
        const streamState = this.activeStreams.get(streamId);
        if (!streamState) return false;

        streamState.volume = clampVolume(volume);
        console.log(`[PcmMixer] Stream ${streamId} volume set to ${streamState.volume}`);
        return true;
    }

    // Applies a volume to every currently-playing stream (used by the /volume command)
    public setAllStreamVolumes(volume: number): void {
        const clamped = clampVolume(volume);
        for (const streamState of this.activeStreams.values()) {
            streamState.volume = clamped;
        }
        console.log(`[PcmMixer] Volume of ${this.activeStreams.size} active stream(s) set to ${clamped}`);
    }

    private handleStreamData(streamId: string, chunk: Buffer): void {
        const bufferList = this.streamBuffers.get(streamId);
        if (!bufferList) return;

        bufferList.push(chunk);
        const bufferedBytes = (this.streamBufferLengths.get(streamId) ?? 0) + chunk.length;
        this.streamBufferLengths.set(streamId, bufferedBytes);

        // Backpressure: stop draining the source once it is more than the high water mark ahead
        const streamState = this.activeStreams.get(streamId);
        if (streamState && !streamState.isPaused && bufferedBytes >= this.bufferHighWaterMark) {
            streamState.isPaused = true;
            streamState.info.stream.pause();
        }
    }

    // Resumes any source that has drained back below the low water mark
    private updateBackpressure(): void {
        for (const [streamId, streamState] of this.activeStreams.entries()) {
            if (!streamState.isPaused) continue;

            const bufferedBytes = this.streamBufferLengths.get(streamId) ?? 0;
            if (bufferedBytes <= this.bufferLowWaterMark) {
                streamState.isPaused = false;
                streamState.info.stream.resume();
            }
        }
    }

    private consumeFromBuffer(streamId: string, byteCount: number): Buffer {
        const bufferList = this.streamBuffers.get(streamId);
        if (!bufferList || bufferList.length === 0) return Buffer.alloc(0);

        const totalAvailable = this.streamBufferLengths.get(streamId) ?? 0;
        const toConsume = Math.min(byteCount, totalAvailable);
        if (toConsume === 0) return Buffer.alloc(0);

        const collected: Buffer[] = [];
        let collectedBytes = 0;

        while (collectedBytes < toConsume && bufferList.length > 0) {
            const front = bufferList[0]!;
            const needed = toConsume - collectedBytes;

            if (front.length <= needed) {
                collected.push(front);
                collectedBytes += front.length;
                bufferList.shift();
            } else {
                collected.push(front.subarray(0, needed));
                bufferList[0] = front.subarray(needed);
                collectedBytes += needed;
            }
        }

        this.streamBufferLengths.set(streamId, totalAvailable - collectedBytes);
        return collected.length === 1 ? collected[0]! : Buffer.concat(collected);
    }

    // Pull-driven output: discord.js' 20ms tick is the only clock in the pipeline.
    override _read(): void {
        this.push(this.mixNextChunk());
    }

    // Produces exactly one 20ms chunk, falling back to silence when nothing is ready
    private mixNextChunk(): Buffer {
        const chunks: Buffer[] = [];
        const volumes: number[] = [];

        for (const [streamId, streamState] of this.activeStreams.entries()) {
            const available = this.streamBufferLengths.get(streamId) ?? 0;

            // Hold a stream back until it has buffered enough to play through smoothly.
            // A stream whose source already ended plays out whatever it managed to buffer.
            if (!streamState.hasStarted) {
                if (!streamState.hasEnded && available < this.initialBufferThreshold) continue;
                streamState.hasStarted = true;
            }

            // Only consume whole frames unless the source has ended, otherwise the next
            // chunk would start mid-sample and swap the stereo channels around.
            const consumable = streamState.hasEnded ? available : Math.floor(available / this.bytesPerSample) * this.bytesPerSample;
            if (consumable === 0) continue;

            const data = this.consumeFromBuffer(streamId, Math.min(this.bytesPerChunk, consumable));
            chunks.push(data.length === this.bytesPerChunk ? data : Buffer.concat([data, Buffer.alloc(this.bytesPerChunk - data.length)]));
            volumes.push(streamState.volume);
        }

        this.updateBackpressure();
        this.cleanupFinishedStreams();

        if (chunks.length === 0) return Buffer.alloc(this.bytesPerChunk);
        return this.mixPcmChunks(chunks, volumes);
    }

    private cleanupFinishedStreams(): void {
        const finished: StreamState[] = [];

        for (const [streamId, streamState] of this.activeStreams.entries()) {
            const totalBytes = this.streamBufferLengths.get(streamId) ?? 0;

            // Remove a stream once its source ended AND its buffer has been played out
            if (streamState.hasEnded && totalBytes < this.bytesPerSample) {
                console.log(`[PcmMixer] Stream ${streamId} finished playing buffered data, removing`);
                this.detachStream(streamId);
                finished.push(streamState);
            }
        }

        for (const streamState of finished) {
            streamState.info.onEnd?.();
        }
    }

    // Drops all mixer state and listeners for a stream without touching its onEnd callback
    private detachStream(streamId: string): void {
        const streamState = this.activeStreams.get(streamId);
        if (streamState) {
            streamState.info.stream.removeListener("data", streamState.onData);
            streamState.info.stream.removeListener("end", streamState.onStreamEnd);
            streamState.info.stream.removeListener("error", streamState.onError);
            if (streamState.isPaused) {
                streamState.isPaused = false;
                streamState.info.stream.resume();
            }
        }

        this.activeStreams.delete(streamId);
        this.streamBuffers.delete(streamId);
        this.streamBufferLengths.delete(streamId);
    }

    private mixPcmChunks(chunks: Buffer[], volumes: number[]): Buffer {
        const firstChunk = chunks[0];
        if (!firstChunk) return Buffer.alloc(0);

        if (chunks.length === 1) {
            // Single stream - just apply its volume
            return this.applyVolume(firstChunk, volumes[0] ?? 1.0);
        }

        const chunkSize = firstChunk.length;
        const samplesCount = chunkSize / this.bytesPerSample;
        const mixedBuffer = Buffer.alloc(chunkSize);

        for (let sampleIndex = 0; sampleIndex < samplesCount; sampleIndex++) {
            for (let channel = 0; channel < this.channels; channel++) {
                const byteIndex = getSampleByteIndex(sampleIndex, channel, this.bytesPerSample);

                // Collect samples from all chunks. Chunks that are too short are skipped,
                // so the volumes have to be collected in lockstep - indexing the original
                // volumes array by chunk position would misattribute them after a skip.
                const samples: number[] = [];
                const sampleVolumes: number[] = [];
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    if (!chunk || chunk.length <= byteIndex + 1) continue;

                    samples.push(readPcmSample(chunk, byteIndex));
                    sampleVolumes.push(volumes[i] ?? 1.0);
                }

                writePcmSample(mixedBuffer, byteIndex, mixSamples(samples, sampleVolumes));
            }
        }

        return mixedBuffer;
    }

    private applyVolume(buffer: Buffer, volume: number): Buffer {
        if (volume === 1.0) return buffer;

        const samplesCount = buffer.length / this.bytesPerSample;
        const volumeBuffer = Buffer.alloc(buffer.length);

        for (let sampleIndex = 0; sampleIndex < samplesCount; sampleIndex++) {
            for (let channel = 0; channel < this.channels; channel++) {
                const byteIndex = getSampleByteIndex(sampleIndex, channel, this.bytesPerSample);
                const sample = readPcmSample(buffer, byteIndex);
                writePcmSample(volumeBuffer, byteIndex, mixSamples([sample], [volume]));
            }
        }

        return volumeBuffer;
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        console.log(`[PcmMixer] Destroying mixer (${this.activeStreams.size} active streams)`);

        for (const streamId of Array.from(this.activeStreams.keys())) {
            this.detachStream(streamId);
        }
        this.activeStreams.clear();
        this.streamBuffers.clear();
        this.streamBufferLengths.clear();

        callback(error);
    }
}

// Volume is expressed as a multiplier: 0.0 (muted) to 2.0 (200%)
function clampVolume(volume: number): number {
    if (!Number.isFinite(volume)) return 1.0;
    return Math.max(0, Math.min(2, volume));
}
