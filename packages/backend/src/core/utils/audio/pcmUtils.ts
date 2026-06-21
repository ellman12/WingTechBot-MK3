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

// Views a (possibly pool-backed, unaligned) PCM buffer as little-endian 16-bit samples.
// Copies into a fresh, 2-byte-aligned ArrayBuffer so Int16Array indexing is always safe and
// the hot mixing loop can avoid per-sample readInt16LE() calls.
function asInt16View(buffer: Buffer): Int16Array {
    const byteLength = buffer.length & ~1; // drop a trailing odd byte if ever present
    const aligned = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + byteLength);
    return new Int16Array(aligned);
}

// Applies a volume multiplier to a single PCM chunk. Returns the input unchanged at unity gain.
export function applyPcmVolume(buffer: Buffer, volume: number): Buffer {
    if (volume === 1.0) return buffer;

    const input = asInt16View(buffer);
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        output[i] = clampSample(Math.round(input[i]! * volume));
    }
    return Buffer.from(output.buffer, output.byteOffset, output.byteLength);
}

// Mixes N equally-shaped PCM chunks into one, summing each per-stream volume-scaled sample and
// clamping. Volume is per-stream (not per-channel), so we can iterate flat over 16-bit lanes
// regardless of channel layout. Chunks shorter than the first contribute silence past their end.
export function mixPcmBuffers(chunks: Buffer[], volumes: number[]): Buffer {
    const firstChunk = chunks[0];
    if (!firstChunk) return Buffer.alloc(0);

    if (chunks.length === 1) {
        return applyPcmVolume(firstChunk, volumes[0] ?? 1.0);
    }

    const views = chunks.map(asInt16View);
    const laneCount = firstChunk.length >> 1;
    const output = new Int16Array(laneCount);

    for (let lane = 0; lane < laneCount; lane++) {
        let acc = 0;
        for (let i = 0; i < views.length; i++) {
            const view = views[i]!;
            if (lane < view.length) {
                acc += view[lane]! * (volumes[i] ?? 1.0);
            }
        }
        output[lane] = clampSample(Math.round(acc));
    }

    return Buffer.from(output.buffer, output.byteOffset, output.byteLength);
}
