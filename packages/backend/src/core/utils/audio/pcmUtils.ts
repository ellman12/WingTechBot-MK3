// Shared PCM audio utilities for reading, writing, and mixing 16-bit signed PCM samples

// Reads a 16-bit signed PCM sample from a buffer (little-endian)
export function readPcmSample(buffer: Buffer, byteIndex: number): number {
    if (byteIndex + 1 >= buffer.length) {
        return 0; // Return silence if out of bounds
    }
    return buffer.readInt16LE(byteIndex);
}

// Clamps a sample value to the valid 16-bit signed range (-32768 to 32767)
export function clampSample(value: number): number {
    return Math.max(-32768, Math.min(32767, value));
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

// Mixes multiple PCM samples together with optional volume scaling
export function mixSamples(samples: number[], volumes?: number[]): number {
    const mixed = samples.reduce((sum, sample, i) => {
        const volume = volumes?.[i] ?? 1.0;
        return sum + sample * volume;
    }, 0);

    return clampSample(Math.round(mixed));
}
