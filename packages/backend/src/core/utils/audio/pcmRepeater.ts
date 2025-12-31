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

/**
 * Creates a PCM stream that plays a sound clip at specified delay times.
 * Properly mixes overlapping audio samples.
 *
 * @param pcmData - The PCM audio data to repeat (must be signed 16-bit PCM)
 * @param delaysMs - Array of delays in milliseconds when to play the sound (e.g., [0, 1000, 2500] plays at 0ms, 1s, and 2.5s)
 * @param options - PCM format options
 * @returns A Readable stream of mixed PCM audio
 */
export function createRepeatedPcmStream(pcmData: Uint8Array | Buffer, delaysMs: number[], options?: PcmStreamOptions): Readable {
    const sampleRate = options?.sampleRate ?? 48000;
    const channels = options?.channels ?? 2;
    const bitDepth = options?.bitDepth ?? 16;
    const bytesPerSample = (bitDepth / 8) * channels;

    console.log(`[PcmRepeater] Creating repeated PCM stream: ${delaysMs.length} repetitions at delays: [${delaysMs.join(", ")}]ms`);

    const clipBuffer = Buffer.from(pcmData);
    const clipLengthSamples = Math.floor(clipBuffer.length / bytesPerSample);

    // Generate schedule of when each repetition should start
    const schedule = generateRepetitionSchedule(clipBuffer, delaysMs, sampleRate);

    // Calculate total length needed
    const lastRepetition = schedule[schedule.length - 1]!;
    const totalSamples = lastRepetition.startSample + clipLengthSamples;
    const totalBytes = totalSamples * bytesPerSample;

    console.log(`[PcmRepeater] Total duration: ${totalSamples / sampleRate}s (${totalBytes} bytes)`);

    // Track current read position
    let currentSample = 0;
    const chunkSizeSamples = 960; // 20ms at 48kHz (standard Discord chunk)

    return new Readable({
        read() {
            // If we've read everything, end the stream
            if (currentSample >= totalSamples) {
                this.push(null);
                return;
            }

            // Determine how many samples to generate in this chunk
            const samplesToGenerate = Math.min(chunkSizeSamples, totalSamples - currentSample);
            const bytesToGenerate = samplesToGenerate * bytesPerSample;

            // Create output buffer for this chunk
            const outputBuffer = Buffer.alloc(bytesToGenerate);

            // Mix all active repetitions into this chunk
            mixRepeatedChunk(outputBuffer, currentSample, samplesToGenerate, schedule, bytesPerSample, channels);

            currentSample += samplesToGenerate;
            this.push(outputBuffer);
        },
    });
}

/**
 * Generates a schedule of when each repetition should start
 */
function generateRepetitionSchedule(clipBuffer: Buffer, delaysMs: number[], sampleRate: number): RepetitionSchedule[] {
    const schedule: RepetitionSchedule[] = [];

    for (const delayMs of delaysMs) {
        const startSample = Math.floor((delayMs / 1000) * sampleRate);
        schedule.push({
            startSample,
            clipData: clipBuffer,
        });
    }

    console.log(`[PcmRepeater] Generated schedule with ${schedule.length} repetitions`);
    return schedule;
}

/**
 * Mixes all active repetitions into the output buffer for a specific chunk
 */
function mixRepeatedChunk(outputBuffer: Buffer, startSample: number, sampleCount: number, schedule: RepetitionSchedule[], bytesPerSample: number, channels: number): void {
    // For each sample in this chunk
    for (let sampleOffset = 0; sampleOffset < sampleCount; sampleOffset++) {
        const absoluteSample = startSample + sampleOffset;

        // Mix all active repetitions at this sample
        for (let ch = 0; ch < channels; ch++) {
            let mixedValue = 0;

            // Check each repetition to see if it's active at this sample
            for (const repetition of schedule) {
                const repetitionOffset = absoluteSample - repetition.startSample;

                // Is this repetition active at this sample?
                if (repetitionOffset >= 0 && repetitionOffset < repetition.clipData.length / bytesPerSample) {
                    const byteIndex = getSampleByteIndex(repetitionOffset, ch, bytesPerSample);
                    const sample = readPcmSample(repetition.clipData, byteIndex);
                    mixedValue += sample;
                }
            }

            // Write mixed sample to output buffer
            const outputByteIndex = getSampleByteIndex(sampleOffset, ch, bytesPerSample);
            writePcmSample(outputBuffer, outputByteIndex, mixedValue);
        }
    }
}
