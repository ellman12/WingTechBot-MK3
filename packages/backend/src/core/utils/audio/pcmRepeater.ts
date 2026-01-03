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

    console.log(`[PcmRepeater] Creating repeated PCM stream: ${delaysMs.length} repetitions at delays: [${delaysMs.join(", ")}]ms`);

    const clipBuffers = pcmData.map(clip => Buffer.from(clip));

    // Generate schedule of when each repetition should start
    const schedule = generateRepetitionSchedule(clipBuffers, delaysMs, sampleRate);

    // Calculate total length needed
    const lastRepetition = schedule[schedule.length - 1]!;
    const totalSamples = lastRepetition.startSample + Math.floor(lastRepetition.clipData.length / bytesPerSample);
    const totalBytes = totalSamples * bytesPerSample;

    console.log(`[PcmRepeater] Total duration: ${totalSamples / sampleRate}s (${totalBytes} bytes)`);

    const chunkSizeSamples = 960; // 20ms at 48kHz (standard Discord chunk)
    const chunkQueue: Buffer[] = [];
    let currentSample = 0;
    let isGenerating = false;
    let generationComplete = false;

    const generateNextChunk = (): void => {
        if (currentSample >= totalSamples) {
            generationComplete = true;
            isGenerating = false;
            return;
        }

        const samplesToGenerate = Math.min(chunkSizeSamples, totalSamples - currentSample);
        const outputBuffer = mixRepeatedChunk(currentSample, samplesToGenerate, schedule, bytesPerSample, channels);

        chunkQueue.push(outputBuffer);
        currentSample += samplesToGenerate;

        setImmediate(generateNextChunk);
    };

    return new Readable({
        read() {
            if (chunkQueue.length > 0) {
                this.push(chunkQueue.shift());
                return;
            }

            if (generationComplete) {
                this.push(null);
                return;
            }

            if (!isGenerating) {
                isGenerating = true;
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

    console.log(`[PcmRepeater] Generated schedule with ${schedule.length} repetitions (additive delays)`);
    return schedule;
}

// Gets all active sample values from repetitions at a specific absolute sample and channel
function getActiveSamples(absoluteSample: number, channel: number, schedule: RepetitionSchedule[], bytesPerSample: number): number[] {
    return schedule
        .map(repetition => {
            const repetitionOffset = absoluteSample - repetition.startSample;
            const isActive = repetitionOffset >= 0 && repetitionOffset < repetition.clipData.length / bytesPerSample;

            if (!isActive) return null;

            const byteIndex = getSampleByteIndex(repetitionOffset, channel, bytesPerSample);
            return readPcmSample(repetition.clipData, byteIndex);
        })
        .filter((sample): sample is number => sample !== null);
}

// Mixes all active repetitions into a new buffer for a specific chunk
function mixRepeatedChunk(startSample: number, sampleCount: number, schedule: RepetitionSchedule[], bytesPerSample: number, channels: number): Buffer {
    const bytesToGenerate = sampleCount * bytesPerSample;
    const outputBuffer = Buffer.alloc(bytesToGenerate);

    for (let sampleOffset = 0; sampleOffset < sampleCount; sampleOffset++) {
        const absoluteSample = startSample + sampleOffset;

        for (let channel = 0; channel < channels; channel++) {
            const activeSamples = getActiveSamples(absoluteSample, channel, schedule, bytesPerSample);
            const mixedValue = activeSamples.reduce((sum, sample) => sum + sample, 0);

            const outputByteIndex = getSampleByteIndex(sampleOffset, channel, bytesPerSample);
            writePcmSample(outputBuffer, outputByteIndex, mixedValue);
        }
    }

    return outputBuffer;
}
