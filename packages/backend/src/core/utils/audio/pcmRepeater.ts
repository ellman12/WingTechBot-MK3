import { logger } from "@core/utils/logger.js";
import { Readable } from "stream";

import { getSampleByteIndex, readPcmSample, writePcmSample } from "./pcmUtils.js";

export type PcmStreamOptions = {
    readonly sampleRate?: number; // default 48000
    readonly channels?: number; // default 2
    readonly bitDepth?: number; // default 16
};

type RepetitionSchedule = {
    readonly startSample: number;
    readonly clipData: Buffer;
};

// Creates a PCM stream that plays a sound clip at specified delay times.
// Properly mixes overlapping audio samples. Pre-computes chunks asynchronously to avoid blocking.
export function createRepeatedPcmStream(pcmData: (Uint8Array | Buffer)[], delaysMs: number[], options?: PcmStreamOptions): Readable {
    const sampleRate = options?.sampleRate ?? 48000;
    const channels = options?.channels ?? 2;
    const bitDepth = options?.bitDepth ?? 16;
    const bytesPerSample = (bitDepth / 8) * channels;

    logger.debug(`[PcmRepeater] Creating repeated PCM stream: ${delaysMs.length} repetitions at delays: [${delaysMs.join(", ")}]ms`);

    const clipBuffers = pcmData.map(clip => Buffer.from(clip));

    // Generate schedule of when each repetition should start
    const schedule = generateRepetitionSchedule(clipBuffers, delaysMs, sampleRate);

    // Calculate total length needed
    const lastRepetition = schedule[schedule.length - 1]!;
    const totalSamples = lastRepetition.startSample + Math.floor(lastRepetition.clipData.length / bytesPerSample);
    const totalBytes = totalSamples * bytesPerSample;

    logger.debug(`[PcmRepeater] Total duration: ${totalSamples / sampleRate}s (${totalBytes} bytes)`);

    const chunkSizeSamples = 960; // 20ms at 48kHz (standard Discord chunk)
    const mixChunk = createWindowedChunkMixer(schedule, bytesPerSample, channels);
    let currentSample = 0;
    let isGenerating = false;
    let generationComplete = false;

    return new Readable({
        read() {
            if (generationComplete) {
                this.push(null);
                return;
            }

            if (!isGenerating) {
                isGenerating = true;

                const generateNextChunk = (): void => {
                    if (currentSample >= totalSamples) {
                        generationComplete = true;
                        isGenerating = false;
                        this.push(null);
                        return;
                    }

                    const samplesToGenerate = Math.min(chunkSizeSamples, totalSamples - currentSample);
                    const outputBuffer = mixChunk(currentSample, samplesToGenerate);
                    currentSample += samplesToGenerate;

                    const shouldContinue = this.push(outputBuffer);
                    if (shouldContinue) {
                        setImmediate(generateNextChunk);
                    } else {
                        isGenerating = false; // Stop until _read() is called again
                    }
                };

                setImmediate(generateNextChunk);
            }
        },
    });
}

// Generates a schedule of when each repetition should start
function generateRepetitionSchedule(clipBuffers: Buffer[], delaysMs: number[], sampleRate: number): RepetitionSchedule[] {
    const schedule = delaysMs.reduce<{ schedule: RepetitionSchedule[]; cumulativeMs: number }>(
        (acc, delayMs, delayIndex) => {
            const clipIndex = delayIndex % clipBuffers.length;
            const cumulativeMs = acc.cumulativeMs + delayMs;
            const startSample = Math.floor((cumulativeMs / 1000) * sampleRate);

            return {
                schedule: [...acc.schedule, { startSample, clipData: clipBuffers[clipIndex]! }],
                cumulativeMs,
            };
        },
        { schedule: [], cumulativeMs: 0 }
    ).schedule;

    logger.debug(`[PcmRepeater] Generated schedule with ${schedule.length} repetitions (additive delays)`);
    return schedule;
}

type ActiveRepetition = {
    readonly startSample: number;
    readonly endSampleExclusive: number; // startSample + clip length in samples (active while abs < this)
    readonly clipData: Buffer;
};

// Builds a stateful chunk mixer that walks the schedule once.
//
// The schedule is sorted by startSample (cumulative, non-negative delays), so as the absolute
// sample advances we only ever *enter* new repetitions and *retire* finished ones. Maintaining a
// small "currently sounding" set turns the old O(repetitions x totalSamples) full-schedule rescan
// into O(totalSamples x overlap), where overlap is just the number of clips audible at once.
//
// Chunks must be requested in order (which the Readable below guarantees) so the window state
// stays consistent across calls.
function createWindowedChunkMixer(schedule: RepetitionSchedule[], bytesPerSample: number, channels: number): (startSample: number, sampleCount: number) => Buffer {
    const repetitions: ActiveRepetition[] = schedule.map(rep => ({
        startSample: rep.startSample,
        endSampleExclusive: rep.startSample + rep.clipData.length / bytesPerSample,
        clipData: rep.clipData,
    }));

    let nextRepIndex = 0;
    const active: ActiveRepetition[] = [];

    return function mixChunk(startSample: number, sampleCount: number): Buffer {
        const outputBuffer = Buffer.alloc(sampleCount * bytesPerSample);

        for (let sampleOffset = 0; sampleOffset < sampleCount; sampleOffset++) {
            const absoluteSample = startSample + sampleOffset;

            // Enter repetitions that have started by this sample.
            while (nextRepIndex < repetitions.length && repetitions[nextRepIndex]!.startSample <= absoluteSample) {
                active.push(repetitions[nextRepIndex]!);
                nextRepIndex++;
            }

            // Retire repetitions that have finished (in place; no allocation when nothing expires).
            for (let i = active.length - 1; i >= 0; i--) {
                if (active[i]!.endSampleExclusive <= absoluteSample) {
                    active.splice(i, 1);
                }
            }

            for (let channel = 0; channel < channels; channel++) {
                let mixedValue = 0;
                for (const rep of active) {
                    const byteIndex = getSampleByteIndex(absoluteSample - rep.startSample, channel, bytesPerSample);
                    mixedValue += readPcmSample(rep.clipData, byteIndex);
                }

                writePcmSample(outputBuffer, getSampleByteIndex(sampleOffset, channel, bytesPerSample), mixedValue);
            }
        }

        return outputBuffer;
    };
}
