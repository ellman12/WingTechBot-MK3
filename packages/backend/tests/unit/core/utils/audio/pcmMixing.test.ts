import { createRepeatedPcmStream } from "@core/utils/audio/pcmRepeater.js";
import { applyPcmVolume, mixPcmBuffers } from "@core/utils/audio/pcmUtils.js";
import { Readable } from "stream";
import { describe, expect, it } from "vitest";

// Build a little-endian 16-bit PCM buffer from sample values.
const i16 = (...samples: number[]): Buffer => Buffer.from(Int16Array.from(samples).buffer);

// Read an Int16Array view of a PCM buffer's samples (for readable assertions).
const samplesOf = (buf: Buffer): number[] => Array.from(new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)));

const collect = (stream: Readable): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", c => chunks.push(c as Buffer));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });

describe("mixPcmBuffers", () => {
    it("returns the input unchanged at unity gain (single stream)", () => {
        const a = i16(100, -200, 300);
        const mixed = mixPcmBuffers([a], [1.0]);
        expect(samplesOf(mixed)).toEqual([100, -200, 300]);
    });

    it("sums multiple streams sample-by-sample", () => {
        const a = i16(100, 200);
        const b = i16(300, 400);
        expect(samplesOf(mixPcmBuffers([a, b], [1.0, 1.0]))).toEqual([400, 600]);
    });

    it("applies per-stream volume before summing, rounding the accumulated value", () => {
        const a = i16(100, 200);
        const b = i16(300, 400);
        // lane0: 100*0.5 + 300*1.0 = 350 ; lane1: 200*0.5 + 400*1.0 = 500
        expect(samplesOf(mixPcmBuffers([a, b], [0.5, 1.0]))).toEqual([350, 500]);
    });

    it("clamps mixed samples to the signed 16-bit range", () => {
        expect(samplesOf(mixPcmBuffers([i16(30000), i16(30000)], [1.0, 1.0]))).toEqual([32767]);
        expect(samplesOf(mixPcmBuffers([i16(-30000), i16(-30000)], [1.0, 1.0]))).toEqual([-32768]);
    });

    it("treats samples past a shorter chunk's end as silence", () => {
        const a = i16(100, 200, 300);
        const b = i16(1000); // only one lane
        expect(samplesOf(mixPcmBuffers([a, b], [1.0, 1.0]))).toEqual([1100, 200, 300]);
    });
});

describe("applyPcmVolume", () => {
    it("scales and clamps samples", () => {
        expect(samplesOf(applyPcmVolume(i16(100, 200), 0.5))).toEqual([50, 100]);
        expect(samplesOf(applyPcmVolume(i16(30000), 2))).toEqual([32767]);
    });

    it("returns the buffer unchanged at unity gain", () => {
        const a = i16(1, 2, 3);
        expect(applyPcmVolume(a, 1.0)).toBe(a);
    });
});

describe("createRepeatedPcmStream", () => {
    const opts = { sampleRate: 1000, channels: 1, bitDepth: 16 };

    it("mixes overlapping repetitions using additive (cumulative) delays", async () => {
        // clip at sample 0 and again at sample 1 (1ms @ 1000Hz) -> overlap mixes
        const out = await collect(createRepeatedPcmStream([i16(100, 200, 300)], [0, 1], opts));
        expect(samplesOf(out)).toEqual([100, 300, 500, 300]);
    });

    it("clamps overlapping repetitions", async () => {
        const out = await collect(createRepeatedPcmStream([i16(30000)], [0, 0], opts));
        expect(samplesOf(out)).toEqual([32767]);
    });

    it("cycles through multiple clips by repetition index", async () => {
        // clips cycle 0,1,0 ; all start at sample 0 -> 10 + 20 + 10
        const out = await collect(createRepeatedPcmStream([i16(10), i16(20)], [0, 0, 0], opts));
        expect(samplesOf(out)).toEqual([40]);
    });

    it("inserts silence between non-overlapping repetitions (window retires then re-enters)", async () => {
        // rep0 @ sample 0, rep1 @ sample 3 (3ms) ; each is one sample long
        const out = await collect(createRepeatedPcmStream([i16(50)], [0, 3], opts));
        expect(samplesOf(out)).toEqual([50, 0, 0, 50]);
    });

    it("mixes overlapping stereo frames per channel", async () => {
        // stereo frame [L=100, R=200] played twice at frame 0
        const stereo = { sampleRate: 1000, channels: 2, bitDepth: 16 };
        const out = await collect(createRepeatedPcmStream([i16(100, 200)], [0, 0], stereo));
        expect(samplesOf(out)).toEqual([200, 400]);
    });
});
