import { PCM_SAMPLE_MAX, PCM_SAMPLE_MIN, clampSample, getSampleByteIndex, mixSamples, readPcmSample, softLimitSample, writePcmSample } from "@core/utils/audio/pcmUtils.js";
import { describe, expect, it } from "vitest";

describe.concurrent("pcmUtils", () => {
    describe("readPcmSample", () => {
        it("should read little-endian 16-bit samples", () => {
            const buffer = Buffer.alloc(4);
            buffer.writeInt16LE(1234, 0);
            buffer.writeInt16LE(-4321, 2);

            expect(readPcmSample(buffer, 0)).toBe(1234);
            expect(readPcmSample(buffer, 2)).toBe(-4321);
        });

        it("should return silence when reading out of bounds", () => {
            const buffer = Buffer.alloc(4);
            buffer.writeInt16LE(1234, 2);

            expect(readPcmSample(buffer, 3)).toBe(0);
            expect(readPcmSample(buffer, 4)).toBe(0);
            expect(readPcmSample(buffer, 100)).toBe(0);
        });
    });

    describe("clampSample", () => {
        it("should clamp to the signed 16-bit range", () => {
            expect(clampSample(0)).toBe(0);
            expect(clampSample(100000)).toBe(PCM_SAMPLE_MAX);
            expect(clampSample(-100000)).toBe(PCM_SAMPLE_MIN);
            expect(clampSample(5000)).toBe(5000);
        });
    });

    describe("writePcmSample", () => {
        it("should round and clamp before writing", () => {
            const buffer = Buffer.alloc(6);

            writePcmSample(buffer, 0, 1000.6);
            writePcmSample(buffer, 2, 50000);
            writePcmSample(buffer, 4, -50000);

            expect(buffer.readInt16LE(0)).toBe(1001);
            expect(buffer.readInt16LE(2)).toBe(PCM_SAMPLE_MAX);
            expect(buffer.readInt16LE(4)).toBe(PCM_SAMPLE_MIN);
        });
    });

    describe("getSampleByteIndex", () => {
        it("should interleave channels", () => {
            expect(getSampleByteIndex(0, 0, 4)).toBe(0);
            expect(getSampleByteIndex(0, 1, 4)).toBe(2);
            expect(getSampleByteIndex(1, 0, 4)).toBe(4);
            expect(getSampleByteIndex(1, 1, 4)).toBe(6);
        });
    });

    describe("softLimitSample", () => {
        it("should leave quiet samples untouched", () => {
            expect(softLimitSample(0)).toBe(0);
            expect(softLimitSample(1000)).toBe(1000);
            expect(softLimitSample(-1000)).toBe(-1000);
            // The knee sits at 75% of full scale
            expect(softLimitSample(24000)).toBe(24000);
        });

        it("should compress loud samples without exceeding full scale", () => {
            const limited = softLimitSample(40000);

            expect(limited).toBeGreaterThan(24575);
            expect(limited).toBeLessThan(PCM_SAMPLE_MAX);
            expect(limited).toBeLessThan(40000);
        });

        it("should stay within range no matter how loud the input is", () => {
            for (const value of [33000, 65535, 200000, 10_000_000]) {
                expect(Math.abs(softLimitSample(value))).toBeLessThanOrEqual(PCM_SAMPLE_MAX);
                expect(Math.abs(softLimitSample(-value))).toBeLessThanOrEqual(PCM_SAMPLE_MAX);
            }
        });

        it("should be symmetric and monotonic", () => {
            expect(softLimitSample(-40000)).toBe(-softLimitSample(40000));
            expect(softLimitSample(30000)).toBeLessThan(softLimitSample(31000));
        });
    });

    describe("mixSamples", () => {
        it("should sum samples when no volumes are given", () => {
            expect(mixSamples([1000, 2000, 3000])).toBe(6000);
            expect(mixSamples([])).toBe(0);
        });

        it("should apply per-sample volumes positionally", () => {
            expect(mixSamples([1000, 2000], [0.5, 0.25])).toBe(1000);
            expect(mixSamples([1000], [2.0])).toBe(2000);
            expect(mixSamples([1000, 2000], [1.0])).toBe(3000); // Missing volume defaults to 1.0
        });

        it("should soft limit instead of hard clipping loud mixes", () => {
            const mixed = mixSamples([20000, 20000]);

            // A hard clamp would have flattened this to exactly PCM_SAMPLE_MAX
            expect(mixed).toBeLessThan(PCM_SAMPLE_MAX);
            expect(mixed).toBeGreaterThan(24575);
        });

        it("should keep loud mixes distinguishable from each other", () => {
            const quieter = mixSamples([20000, 15000]);
            const louder = mixSamples([20000, 20000]);

            expect(louder).toBeGreaterThan(quieter);
        });

        it("should never leave the 16-bit range", () => {
            expect(mixSamples([32767, 32767, 32767, 32767])).toBeLessThanOrEqual(PCM_SAMPLE_MAX);
            expect(mixSamples([-32768, -32768, -32768, -32768])).toBeGreaterThanOrEqual(PCM_SAMPLE_MIN);
        });
    });
});
