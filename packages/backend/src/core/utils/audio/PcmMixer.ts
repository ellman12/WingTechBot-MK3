import { Transform, type TransformCallback } from "stream";

import { getSampleByteIndex, mixSamples, readPcmSample, writePcmSample } from "./pcmUtils.js";

export type PcmStreamInfo = {
    readonly id: string;
    readonly stream: NodeJS.ReadableStream;
    readonly volume: number; // 0.0 to 1.0
    readonly onEnd?: () => void;
};

type StreamState = {
    info: PcmStreamInfo;
    hasEnded: boolean;
};

export type PcmMixerOptions = {
    readonly sampleRate: number; // 48000 for Discord
    readonly channels: number; // 2 for stereo
    readonly bitDepth: number; // 16 for signed 16-bit
    readonly maxConcurrentStreams?: number;
};

export class PcmMixer extends Transform {
    private readonly sampleRate: number;
    private readonly channels: number;
    private readonly bitDepth: number;
    private readonly bytesPerSample: number;
    private readonly maxConcurrentStreams: number;

    private activeStreams = new Map<string, StreamState>();
    private streamBuffers = new Map<string, Buffer>();
    private isProcessing = false;
    private processingInterval: NodeJS.Timeout | null = null;
    private readonly minBufferSize: number; // Minimum buffer before mixing

    constructor(options: PcmMixerOptions) {
        super({
            objectMode: false,
            highWaterMark: 128 * 1024, // Increased to 128KB for smoother playback
        });

        this.sampleRate = options.sampleRate;
        this.channels = options.channels;
        this.bitDepth = options.bitDepth;
        this.bytesPerSample = (this.bitDepth / 8) * this.channels;
        this.maxConcurrentStreams = options.maxConcurrentStreams ?? 8;

        // Calculate minimum buffer size (40ms worth of audio for smoother playback)
        const samplesPerBuffer = Math.floor(this.sampleRate * 0.04); // 40ms
        this.minBufferSize = samplesPerBuffer * this.bytesPerSample;

        console.log(`[PcmMixer] Initialized mixer: ${this.sampleRate}Hz, ${this.channels}ch, ${this.bitDepth}-bit, minBuffer: ${this.minBufferSize} bytes`);
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

        this.activeStreams.set(streamInfo.id, {
            info: streamInfo,
            hasEnded: false,
        });
        this.streamBuffers.set(streamInfo.id, Buffer.alloc(0));

        // Set up stream handlers
        streamInfo.stream.on("data", (chunk: Buffer) => {
            this.handleStreamData(streamInfo.id, chunk);
        });

        streamInfo.stream.on("end", () => {
            console.log(`[PcmMixer] Stream ${streamInfo.id} ended - marking as ended but keeping buffered data`);
            const streamState = this.activeStreams.get(streamInfo.id);
            if (streamState) {
                streamState.hasEnded = true;
            }
            // Don't call onEnd yet - wait until buffer is drained
        });

        streamInfo.stream.on("error", error => {
            console.error(`[PcmMixer] Stream ${streamInfo.id} error:`, error);
            this.removeStream(streamInfo.id);
        });

        // Start processing if this is the first stream
        if (this.activeStreams.size === 1 && !this.isProcessing) {
            this.startProcessing();
        }

        return true;
    }

    public removeStream(streamId: string): boolean {
        if (!this.activeStreams.has(streamId)) {
            return false;
        }

        console.log(`[PcmMixer] Force removing stream: ${streamId}`);
        const streamState = this.activeStreams.get(streamId);
        if (streamState) {
            streamState.info.onEnd?.(); // Call onEnd when force removing
        }

        this.activeStreams.delete(streamId);
        this.streamBuffers.delete(streamId);

        // Stop processing if no streams remain
        if (this.activeStreams.size === 0) {
            this.stopProcessing();
        }

        return true;
    }

    public getActiveStreamCount(): number {
        return this.activeStreams.size;
    }

    public getActiveStreamIds(): string[] {
        return Array.from(this.activeStreams.keys());
    }

    private handleStreamData(streamId: string, chunk: Buffer): void {
        const existingBuffer = this.streamBuffers.get(streamId);
        if (existingBuffer) {
            this.streamBuffers.set(streamId, Buffer.concat([existingBuffer, chunk]));
        }
    }

    private startProcessing(): void {
        if (this.isProcessing) return;

        console.log(`[PcmMixer] Starting audio processing with ${this.activeStreams.size} streams`);
        this.isProcessing = true;

        // Process every 20ms to match the chunk size (20ms of audio at 48kHz)
        this.processingInterval = setInterval(() => {
            this.processAudio();
        }, 20);
    }

    private stopProcessing(): void {
        console.log(`[PcmMixer] Stopping audio processing`);
        this.isProcessing = false;
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    private processAudio(): void {
        if (!this.isProcessing || this.activeStreams.size === 0) {
            return;
        }

        // Process audio in chunks of ~20ms (960 samples at 48kHz)
        const samplesPerChunk = Math.floor(this.sampleRate * 0.02); // 20ms
        const bytesPerChunk = samplesPerChunk * this.bytesPerSample;

        // Check if we have enough buffered data across all streams
        const hasEnoughData = this.checkMinimumBufferLevel(bytesPerChunk);

        if (hasEnoughData && this.streamBuffers.size > 0) {
            const mixedChunk = this.mixChunk(bytesPerChunk);
            if (mixedChunk && mixedChunk.length > 0) {
                this.push(mixedChunk);
            }
        }
        // Note: Removed silence padding - better to wait for data than push gaps

        // Clean up streams that have ended AND have empty buffers
        this.cleanupFinishedStreams();
    }

    private checkMinimumBufferLevel(requiredBytes: number): boolean {
        // Check if at least one active stream has enough data
        // This prevents mixing partial chunks that cause audio artifacts
        for (const [streamId, streamState] of this.activeStreams.entries()) {
            if (streamState.hasEnded) continue; // Skip ended streams

            const buffer = this.streamBuffers.get(streamId);
            if (buffer && buffer.length >= requiredBytes) {
                return true; // At least one stream has enough data
            }
        }

        // If all streams have ended, allow mixing of remaining data
        const allEnded = Array.from(this.activeStreams.values()).every(s => s.hasEnded);
        return allEnded;
    }

    private cleanupFinishedStreams(): void {
        const streamsToRemove: string[] = [];

        for (const [streamId, streamState] of this.activeStreams.entries()) {
            const buffer = this.streamBuffers.get(streamId);

            // Remove stream if it has ended AND its buffer is empty (or very small)
            if (streamState.hasEnded && (!buffer || buffer.length < this.bytesPerSample)) {
                console.log(`[PcmMixer] Stream ${streamId} finished playing buffered data, removing`);
                streamsToRemove.push(streamId);
            }
        }

        // Remove finished streams
        for (const streamId of streamsToRemove) {
            const streamState = this.activeStreams.get(streamId);
            if (streamState) {
                streamState.info.onEnd?.(); // Now call onEnd
            }
            this.activeStreams.delete(streamId);
            this.streamBuffers.delete(streamId);
        }

        // Stop processing only if NO streams remain (not even ended ones with buffered data)
        if (this.activeStreams.size === 0) {
            console.log(`[PcmMixer] All streams finished, stopping processing`);
            this.stopProcessing();
        }
    }

    private mixChunk(chunkSize: number): Buffer | null {
        const streamIds = Array.from(this.streamBuffers.keys());
        if (streamIds.length === 0) return null;

        // Extract chunks from each stream, padding with silence if needed
        const chunks: Buffer[] = [];
        const streamVolumes: number[] = [];

        for (const streamId of streamIds) {
            const buffer = this.streamBuffers.get(streamId);
            const streamState = this.activeStreams.get(streamId);

            if (!buffer || !streamState) continue;

            if (buffer.length >= chunkSize) {
                // Stream has enough data
                const chunk = buffer.subarray(0, chunkSize);
                chunks.push(chunk);
                streamVolumes.push(streamState.info.volume);
                this.streamBuffers.set(streamId, buffer.subarray(chunkSize));
            } else {
                // Stream doesn't have enough data - pad with available data + silence
                const availableData = buffer.length > 0 ? buffer : Buffer.alloc(0);
                const silencePadding = Buffer.alloc(chunkSize - availableData.length);
                const paddedChunk = Buffer.concat([availableData, silencePadding]);

                chunks.push(paddedChunk);
                streamVolumes.push(streamState.info.volume);
                this.streamBuffers.set(streamId, Buffer.alloc(0)); // Clear the buffer since we used all available data
            }
        }

        // Mix the chunks
        return this.mixPcmChunks(chunks, streamVolumes);
    }

    private mixPcmChunks(chunks: Buffer[], volumes: number[]): Buffer {
        if (chunks.length === 0) return Buffer.alloc(0);

        const firstChunk = chunks[0];
        if (!firstChunk) return Buffer.alloc(0);

        if (chunks.length === 1) {
            // Apply volume to single stream
            const volume = volumes[0] ?? 1.0;
            return this.applyVolume(firstChunk, volume);
        }

        const chunkSize = firstChunk.length;
        const samplesCount = chunkSize / this.bytesPerSample;
        const mixedBuffer = Buffer.alloc(chunkSize);

        // Mix samples
        for (let sampleIndex = 0; sampleIndex < samplesCount; sampleIndex++) {
            for (let channel = 0; channel < this.channels; channel++) {
                const byteIndex = getSampleByteIndex(sampleIndex, channel, this.bytesPerSample);

                // Collect samples from all chunks
                const samples: number[] = [];
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    if (!chunk || chunk.length <= byteIndex + 1) continue;

                    const sample = readPcmSample(chunk, byteIndex);
                    samples.push(sample);
                }

                // Mix and write the result
                const mixedSample = mixSamples(samples, volumes);
                writePcmSample(mixedBuffer, byteIndex, mixedSample);
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
                const volumeSample = sample * volume;
                writePcmSample(volumeBuffer, byteIndex, volumeSample);
            }
        }

        return volumeBuffer;
    }

    override _transform(_chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
        // This mixer doesn't process input chunks directly, it manages multiple input streams
        // So we just ignore input to the transform stream
        callback();
    }

    override _flush(callback: TransformCallback): void {
        console.log(`[PcmMixer] Flushing mixer`);
        this.stopProcessing();
        callback();
    }
}
