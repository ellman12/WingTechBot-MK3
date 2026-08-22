import { PcmMixer, type PcmMixerOptions } from "@core/utils/audio/PcmMixer.js";
import { Readable } from "stream";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Discord audio format: 48kHz, 2 channels, signed 16-bit LE
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_FRAME = 4;
const CHUNK_BYTES = 3840; // 20ms
const ONE_SECOND_BYTES = SAMPLE_RATE * BYTES_PER_FRAME;

// The mixer holds a source back until it has buffered 60ms, so tests push at least that much
const BUFFERED_CHUNKS = 3;

const DEFAULT_OPTIONS: PcmMixerOptions = { sampleRate: SAMPLE_RATE, channels: CHANNELS, bitDepth: 16 };

const mixers: PcmMixer[] = [];

// Creates a mixer that is torn down after the test
const createMixer = (options: Partial<PcmMixerOptions> = {}): PcmMixer => {
    const mixer = new PcmMixer({ ...DEFAULT_OPTIONS, ...options });
    mixers.push(mixer);
    return mixer;
};

// A source whose data we push by hand so the tests stay deterministic
const createSource = (): Readable =>
    new Readable({
        read() {
            // Data is pushed explicitly by the test
        },
    });

// A buffer of `chunks` 20ms chunks where every sample has the same value
const constantPcm = (value: number, chunks = 1): Buffer => {
    const buffer = Buffer.alloc(CHUNK_BYTES * chunks);
    for (let byteIndex = 0; byteIndex < buffer.length; byteIndex += 2) {
        buffer.writeInt16LE(value, byteIndex);
    }
    return buffer;
};

const readChunk = (mixer: PcmMixer): Buffer => {
    const chunk = mixer.read(CHUNK_BYTES) as Buffer | null;
    expect(chunk).not.toBeNull();
    expect(chunk!.length).toBe(CHUNK_BYTES);
    return chunk!;
};

const samplesOf = (chunk: Buffer): number[] => {
    const samples: number[] = [];
    for (let byteIndex = 0; byteIndex < chunk.length; byteIndex += 2) {
        samples.push(chunk.readInt16LE(byteIndex));
    }
    return samples;
};

const isConstant = (chunk: Buffer, value: number): boolean => samplesOf(chunk).every(sample => sample === value);

const expectAllSamples = (chunk: Buffer, value: number): void => {
    // Compare via a filtered list so a failure reports the offending samples, not 1920 of them
    expect(samplesOf(chunk).filter(sample => sample !== value)).toEqual([]);
};

// Node delivers "data" events asynchronously, so pushed audio only reaches the mixer after
// a couple of turns of the event loop. Tests therefore push all their audio, flush once,
// and then read synchronously: a synchronous read sequence is never interrupted by the
// readable's own read-ahead, which keeps the assertions exact.
const flush = async (): Promise<void> => {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
};

describe("PcmMixer", () => {
    beforeAll(() => {
        // The mixer logs on every stream add/remove; keep the test output readable
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        for (const mixer of mixers.splice(0)) {
            mixer.destroy();
        }
    });

    describe("mixing", () => {
        it("should sum two streams sample by sample", async () => {
            const mixer = createMixer();
            const first = createSource();
            const second = createSource();

            mixer.addStream({ id: "a", stream: first, volume: 1.0 });
            mixer.addStream({ id: "b", stream: second, volume: 1.0 });

            first.push(constantPcm(1000, BUFFERED_CHUNKS));
            second.push(constantPcm(2000, BUFFERED_CHUNKS));
            await flush();

            expectAllSamples(readChunk(mixer), 3000);
        });

        it("should scale each stream by its own volume", async () => {
            const mixer = createMixer();
            const first = createSource();
            const second = createSource();

            mixer.addStream({ id: "a", stream: first, volume: 0.5 });
            mixer.addStream({ id: "b", stream: second, volume: 0.25 });

            first.push(constantPcm(1000, BUFFERED_CHUNKS));
            second.push(constantPcm(2000, BUFFERED_CHUNKS));
            await flush();

            expectAllSamples(readChunk(mixer), 1000);
        });

        it("should amplify a single stream above 100% volume", async () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "loud", stream: source, volume: 2.0 });
            source.push(constantPcm(5000, BUFFERED_CHUNKS));
            await flush();

            expectAllSamples(readChunk(mixer), 10000);
        });

        it("should clamp a volume above 200% down to 200%", async () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "louder", stream: source, volume: 8.0 });
            expect(mixer.getStreamVolume("louder")).toBe(2.0);

            source.push(constantPcm(5000, BUFFERED_CHUNKS));
            await flush();

            expectAllSamples(readChunk(mixer), 10000);
        });

        it("should soft limit loud overlapping streams instead of hard clipping", async () => {
            const mixer = createMixer();
            const first = createSource();
            const second = createSource();

            mixer.addStream({ id: "a", stream: first, volume: 1.0 });
            mixer.addStream({ id: "b", stream: second, volume: 1.0 });

            first.push(constantPcm(20000, BUFFERED_CHUNKS));
            second.push(constantPcm(20000, BUFFERED_CHUNKS));
            await flush();

            const samples = samplesOf(readChunk(mixer));
            const value = samples[0]!;

            // A hard clamp would have flattened the 40000 sum to exactly 32767
            expect(value).toBeLessThan(32767);
            expect(value).toBeGreaterThan(24575);
            expect(samples.every(sample => sample === value)).toBe(true);
        });

        it("should pad a short stream with silence and keep each volume with its own stream", async () => {
            const mixer = createMixer();
            const short = createSource();
            const full = createSource();

            mixer.addStream({ id: "short", stream: short, volume: 1.0 });
            mixer.addStream({ id: "full", stream: full, volume: 0.5 });

            // The short stream only has half a chunk and then ends, so it gets zero padded
            short.push(constantPcm(1000).subarray(0, CHUNK_BYTES / 2));
            short.push(null);
            full.push(constantPcm(4000, BUFFERED_CHUNKS));
            await flush();

            const samples = samplesOf(readChunk(mixer));

            // First half: 1000 (short, volume 1.0) + 4000 * 0.5 (full)
            expect(samples[0]).toBe(3000);
            // Second half: the short stream contributes silence, the full one keeps its own volume
            expect(samples[samples.length - 1]).toBe(2000);
        });
    });

    describe("silence bus", () => {
        it("should emit silence when there are no streams at all", () => {
            const mixer = createMixer();

            expectAllSamples(readChunk(mixer), 0);
        });

        it("should emit silence when a stream has no data ready", () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });

            expectAllSamples(readChunk(mixer), 0);
            expect(mixer.getActiveStreamCount()).toBe(1);
        });

        it("should keep producing silence after a stream has finished", async () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });
            source.push(constantPcm(1000));
            source.push(null);
            await flush();

            expectAllSamples(readChunk(mixer), 1000);
            expect(mixer.getActiveStreamCount()).toBe(0);

            // The bus stays alive so the discord.js player never goes idle
            expectAllSamples(readChunk(mixer), 0);
            expectAllSamples(readChunk(mixer), 0);
        });

        it("should hold a stream back until it has buffered enough audio", async () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });

            // 20ms is below the 60ms initial buffer threshold
            source.push(constantPcm(1000));
            await flush();

            expectAllSamples(readChunk(mixer), 0);
            expectAllSamples(readChunk(mixer), 0);

            // Once the threshold is met the buffered audio plays out
            source.push(constantPcm(1000, BUFFERED_CHUNKS));
            await flush();

            const chunks = Array.from({ length: 6 }, () => readChunk(mixer));
            expect(chunks.some(chunk => isConstant(chunk, 1000))).toBe(true);
        });
    });

    describe("ingest backpressure", () => {
        it("should pause a source above the high water mark and resume it below the low water mark", async () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });

            // The default high water mark is 2 seconds of PCM
            source.push(constantPcm(1000, (2 * ONE_SECOND_BYTES) / CHUNK_BYTES));
            await flush();

            expect(source.isPaused()).toBe(true);

            // Draining back below the 0.5s low water mark resumes the source
            let reads = 0;
            while (source.isPaused() && reads < 200) {
                readChunk(mixer);
                reads++;
            }

            expect(source.isPaused()).toBe(false);
            // 2s buffered, resuming at 0.5s: 1.5s of audio, i.e. 75 chunks of 20ms
            expect(reads).toBe(75);
        });

        it("should not pause a source that stays under the high water mark", async () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });
            source.push(constantPcm(1000, BUFFERED_CHUNKS));
            await flush();

            expect(source.isPaused()).toBe(false);
        });

        it("should honour custom watermarks", async () => {
            const mixer = createMixer({ bufferHighWaterMark: CHUNK_BYTES * 2, bufferLowWaterMark: CHUNK_BYTES });
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });
            source.push(constantPcm(1000, 4));
            await flush();

            expect(source.isPaused()).toBe(true);

            readChunk(mixer);
            expect(source.isPaused()).toBe(true);
            readChunk(mixer);
            readChunk(mixer);

            expect(source.isPaused()).toBe(false);
        });
    });

    describe("stream lifecycle", () => {
        it("should refuse duplicate stream ids", () => {
            const mixer = createMixer();
            const source = createSource();

            expect(mixer.addStream({ id: "a", stream: source, volume: 1.0 })).toBe(true);
            expect(mixer.addStream({ id: "a", stream: createSource(), volume: 1.0 })).toBe(false);
            expect(mixer.getActiveStreamIds()).toEqual(["a"]);
        });

        it("should refuse streams beyond the concurrency limit", () => {
            const mixer = createMixer({ maxConcurrentStreams: 2 });

            expect(mixer.addStream({ id: "a", stream: createSource(), volume: 1.0 })).toBe(true);
            expect(mixer.addStream({ id: "b", stream: createSource(), volume: 1.0 })).toBe(true);
            expect(mixer.addStream({ id: "c", stream: createSource(), volume: 1.0 })).toBe(false);
            expect(mixer.getActiveStreamCount()).toBe(2);
        });

        it("should call onEnd and drop the stream when it is force removed", () => {
            const mixer = createMixer();
            const source = createSource();
            const onEnd = vi.fn();

            mixer.addStream({ id: "a", stream: source, volume: 1.0, onEnd });

            expect(mixer.removeStream("a")).toBe(true);
            expect(onEnd).toHaveBeenCalledTimes(1);
            expect(mixer.getActiveStreamCount()).toBe(0);
            expect(source.listenerCount("data")).toBe(0);

            // Removing again is a no-op
            expect(mixer.removeStream("a")).toBe(false);
            expect(onEnd).toHaveBeenCalledTimes(1);
        });

        it("should delay onEnd until the buffered audio has been mixed out", async () => {
            const mixer = createMixer();
            const source = createSource();
            const onEnd = vi.fn();

            mixer.addStream({ id: "a", stream: source, volume: 1.0, onEnd });
            source.push(constantPcm(1000, 2));
            source.push(null);
            await flush();

            expect(onEnd).not.toHaveBeenCalled();

            expectAllSamples(readChunk(mixer), 1000);
            expect(onEnd).not.toHaveBeenCalled();
            expect(mixer.getActiveStreamCount()).toBe(1);

            expectAllSamples(readChunk(mixer), 1000);
            expect(onEnd).toHaveBeenCalledTimes(1);
            expect(mixer.getActiveStreamCount()).toBe(0);
        });

        it("should drop a stream that errors", () => {
            const mixer = createMixer();
            const source = createSource();
            const onEnd = vi.fn();

            mixer.addStream({ id: "a", stream: source, volume: 1.0, onEnd });
            source.emit("error", new Error("boom"));

            expect(mixer.getActiveStreamCount()).toBe(0);
            expect(onEnd).toHaveBeenCalledTimes(1);
        });

        it("should detach every source listener when destroyed", () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });
            mixer.destroy();

            expect(mixer.destroyed).toBe(true);
            expect(mixer.getActiveStreamCount()).toBe(0);
            expect(source.listenerCount("data")).toBe(0);
            expect(source.listenerCount("end")).toBe(0);
            expect(source.listenerCount("error")).toBe(0);
        });
    });

    describe("volume changes while playing", () => {
        it("should apply setStreamVolume to the next mixed chunk", async () => {
            const mixer = createMixer();
            const source = createSource();

            mixer.addStream({ id: "a", stream: source, volume: 1.0 });
            source.push(constantPcm(1000, 4));
            await flush();

            expectAllSamples(readChunk(mixer), 1000);

            expect(mixer.setStreamVolume("a", 2.0)).toBe(true);
            expectAllSamples(readChunk(mixer), 2000);
        });

        it("should report null or false for an unknown stream", () => {
            const mixer = createMixer();

            expect(mixer.setStreamVolume("nope", 1.5)).toBe(false);
            expect(mixer.getStreamVolume("nope")).toBeNull();
        });

        it("should apply setAllStreamVolumes to every playing stream", async () => {
            const mixer = createMixer();
            const first = createSource();
            const second = createSource();

            mixer.addStream({ id: "a", stream: first, volume: 1.0 });
            mixer.addStream({ id: "b", stream: second, volume: 1.0 });
            first.push(constantPcm(1000, 4));
            second.push(constantPcm(2000, 4));
            await flush();

            expectAllSamples(readChunk(mixer), 3000);

            mixer.setAllStreamVolumes(0.5);
            expectAllSamples(readChunk(mixer), 1500);
            expect(mixer.getStreamVolume("a")).toBe(0.5);
            expect(mixer.getStreamVolume("b")).toBe(0.5);
        });
    });
});
