// Shared PCM audio utilities for reading, writing, and mixing 16-bit signed PCM samples

// Bounds of a signed 16-bit PCM sample
export const PCM_SAMPLE_MAX = 32767;
export const PCM_SAMPLE_MIN = -32768;

// Fraction of full scale that passes through the soft limiter untouched.
// Everything below the knee is bit-for-bit identical to the input sum; above it the
// curve compresses smoothly towards full scale instead of clipping flat.
const SOFT_LIMIT_KNEE_RATIO = 0.75;
const SOFT_LIMIT_KNEE = SOFT_LIMIT_KNEE_RATIO * PCM_SAMPLE_MAX;
const SOFT_LIMIT_HEADROOM = PCM_SAMPLE_MAX - SOFT_LIMIT_KNEE;

// Reads a 16-bit signed PCM sample from a buffer (little-endian)
export function readPcmSample(buffer: Buffer, byteIndex: number): number {
    if (byteIndex + 1 >= buffer.length) {
        return 0; // Return silence if out of bounds
    }
    return buffer.readInt16LE(byteIndex);
}

// Clamps a sample value to the valid 16-bit signed range (-32768 to 32767)
export function clampSample(value: number): number {
    return Math.max(PCM_SAMPLE_MIN, Math.min(PCM_SAMPLE_MAX, value));
}

// Soft-limits a floating point sample into the 16-bit signed range.
// Signals below the knee are untouched, louder signals are compressed along a tanh
// curve that asymptotically approaches full scale. This keeps several overlapping
// streams (or a stream at >100% volume) from clipping into a flat, distorted wall.
export function softLimitSample(value: number): number {
    const magnitude = Math.abs(value);
    if (magnitude <= SOFT_LIMIT_KNEE) return value;

    const overshoot = (magnitude - SOFT_LIMIT_KNEE) / SOFT_LIMIT_HEADROOM;
    const limited = SOFT_LIMIT_KNEE + SOFT_LIMIT_HEADROOM * Math.tanh(overshoot);
    return value < 0 ? -limited : limited;
}

// Writes a 16-bit signed PCM sample to a buffer (little-endian)
// Automatically clamps the value to prevent clipping
export function writePcmSample(buffer: Buffer, byteIndex: number, value: number): void {
    const clampedValue = clampSample(Math.round(value));
    buffer.writeInt16LE(clampedValue, byteIndex);
}

// Calculates the byte index for a specific sample and channel
export function getSampleByteIndex(sampleIndex: number, channel: number, bytesPerSample: number): number {
    return sampleIndex * bytesPerSample + channel * 2; // 2 bytes per 16-bit sample
}

// Mixes multiple PCM samples together with optional volume scaling.
// `volumes` is indexed in lockstep with `samples` - callers must keep the two arrays aligned.
// The sum is accumulated in floating point (so headroom is preserved) and then passed
// through the soft limiter rather than being hard-clamped per sample.
export function mixSamples(samples: number[], volumes?: number[]): number {
    const mixed = samples.reduce((sum, sample, i) => {
        const volume = volumes?.[i] ?? 1.0;
        return sum + sample * volume;
    }, 0);

    return clampSample(Math.round(softLimitSample(mixed)));
}
