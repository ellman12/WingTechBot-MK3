import { AudioFetchTimeoutError, AudioSizeLimitError } from "@core/errors/AudioErrors.js";
import { PassThrough, type Readable } from "stream";

export const createPreBufferedStream = async (sourceStream: Readable, sourceName: string, abortSignal?: AbortSignal): Promise<Readable> => {
    console.log(`[SoundService] Creating pre-buffered stream for: ${sourceName}`);

    const bufferedStream = new PassThrough({
        highWaterMark: 64 * 1024, // 64KB buffer
        objectMode: false,
    });

    const preBufferTarget = 32 * 1024; // Wait for 32KB before resolving
    let bytesBuffered = 0;
    const prebufferStartTime = Date.now();

    return new Promise((resolve, reject) => {
        let isResolved = false;

        // Handle abort signal
        if (abortSignal?.aborted) {
            sourceStream.destroy();
            bufferedStream.destroy();
            reject(new Error("Pre-buffering aborted"));
            return;
        }

        const abortHandler = () => {
            if (!isResolved) {
                console.log(`[SoundService] Pre-buffering aborted for: ${sourceName}`);
                sourceStream.destroy();
                bufferedStream.destroy();
                isResolved = true;
                reject(new Error("Pre-buffering aborted"));
            }
        };

        abortSignal?.addEventListener("abort", abortHandler);

        const onData = (chunk: Buffer) => {
            bytesBuffered += chunk.length;

            // Write to buffer immediately
            if (!bufferedStream.destroyed) {
                bufferedStream.write(chunk);
            }

            // Check if we've hit our pre-buffer target
            if (!isResolved && bytesBuffered >= preBufferTarget) {
                const prebufferTime = Date.now() - prebufferStartTime;
                console.log(`[SoundService] Pre-buffer target reached for ${sourceName}: ${bytesBuffered} bytes in ${prebufferTime}ms`);
                isResolved = true;
                abortSignal?.removeEventListener("abort", abortHandler);
                resolve(bufferedStream);
            }
        };

        const onEnd = () => {
            console.log(`[SoundService] Source stream ended for: ${sourceName}, total bytes: ${bytesBuffered}`);
            if (!bufferedStream.destroyed) {
                bufferedStream.end();
            }

            // If stream ended before reaching target, resolve anyway
            if (!isResolved) {
                console.log(`[SoundService] Stream ended before pre-buffer target, resolving with ${bytesBuffered} bytes`);
                isResolved = true;
                abortSignal?.removeEventListener("abort", abortHandler);
                resolve(bufferedStream);
            }
        };

        const onError = (error: Error) => {
            console.error(`[SoundService] Source stream error for ${sourceName}:`, error);
            bufferedStream.destroy(error);
            if (!isResolved) {
                isResolved = true;
                reject(error);
            }
        };

        sourceStream.on("data", onData);
        sourceStream.on("end", onEnd);
        sourceStream.on("error", onError);

        // Timeout fallback - resolve after 10 seconds even if not fully buffered
        const timeout = setTimeout(() => {
            if (!isResolved) {
                console.log(`[SoundService] Pre-buffer timeout for ${sourceName}, resolving with ${bytesBuffered} bytes`);
                isResolved = true;
                abortSignal?.removeEventListener("abort", abortHandler);
                resolve(bufferedStream);
            }
        }, 10000);

        // Clean up timeout when resolved
        bufferedStream.on("close", () => {
            clearTimeout(timeout);
        });
    });
};

export type ReadStreamToBytesOptions = {
    // Hard ceiling on buffered bytes. Exceeding it destroys the stream and throws AudioSizeLimitError.
    readonly limitBytes: number;
    // Label used in error messages (a URL, a sound name, a file path).
    readonly sourceName: string;
    // Max time allowed between two chunks. This is deliberately an *inactivity* timeout rather
    // than a wall-clock one: a slow-but-progressing download is legitimate, a server that stops
    // sending is not. Omit to disable.
    readonly idleTimeoutMs?: number;
};

// Buffers a stream into memory under an explicit size cap and optional inactivity timeout.
// Every audio source is attacker-influenced, so unbounded buffering is never acceptable here.
export const readStreamToBytes = (stream: Readable, { limitBytes, sourceName, idleTimeoutMs }: ReadStreamToBytesOptions): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        let total = 0;
        let settled = false;
        let idleTimer: NodeJS.Timeout | undefined;

        const clearIdleTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = undefined;
        };

        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            clearIdleTimer();
            stream.destroy();
            reject(error);
        };

        const armIdleTimer = () => {
            if (idleTimeoutMs === undefined) return;
            clearIdleTimer();
            idleTimer = setTimeout(() => {
                fail(new AudioFetchTimeoutError(`Stalled for ${idleTimeoutMs}ms while reading: ${sourceName}`, { url: sourceName, timeoutMs: idleTimeoutMs }));
            }, idleTimeoutMs);
        };

        stream.on("data", (chunk: Buffer) => {
            if (settled) return;
            total += chunk.length;
            if (total > limitBytes) {
                fail(new AudioSizeLimitError(`Audio exceeds the ${Math.round(limitBytes / 1024 / 1024)}MB size limit: ${sourceName}`, { sizeBytes: total, limitBytes }));
                return;
            }
            chunks.push(chunk);
            armIdleTimer();
        });

        stream.on("end", () => {
            if (settled) return;
            settled = true;
            clearIdleTimer();
            resolve(Buffer.concat(chunks));
        });

        stream.on("error", err => {
            fail(err instanceof Error ? err : new Error(String(err)));
        });

        armIdleTimer();
    });
};
