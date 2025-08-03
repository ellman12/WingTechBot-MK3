import { PassThrough, type Readable } from "stream";

export const createPreBufferedStream = async (sourceStream: Readable, sourceName: string, abortSignal?: AbortSignal): Promise<Readable> => {
    console.log(`[SoundService] Creating pre-buffered stream for: ${sourceName}`);

    const bufferedStream = new PassThrough({
        highWaterMark: 256 * 1024, // 256KB buffer
        objectMode: false,
    });

    const preBufferTarget = 128 * 1024; // Wait for 128KB before resolving
    let bytesBuffered = 0;
    const prebufferStartTime = Date.now();

    return new Promise((resolve, reject) => {
        let isResolved = false;

        // Handle abort signal
        if (abortSignal?.aborted) {
            sourceStream.destroy();
            bufferedStream.destroy();
            reject(new Error('Pre-buffering aborted'));
            return;
        }

        const abortHandler = () => {
            if (!isResolved) {
                console.log(`[SoundService] Pre-buffering aborted for: ${sourceName}`);
                sourceStream.destroy();
                bufferedStream.destroy();
                isResolved = true;
                reject(new Error('Pre-buffering aborted'));
            }
        };

        abortSignal?.addEventListener('abort', abortHandler);

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
                abortSignal?.removeEventListener('abort', abortHandler);
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
                abortSignal?.removeEventListener('abort', abortHandler);
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
                abortSignal?.removeEventListener('abort', abortHandler);
                resolve(bufferedStream);
            }
        }, 10000);

        // Clean up timeout when resolved
        bufferedStream.on("close", () => {
            clearTimeout(timeout);
        });
    });
};

export const createBufferedStream = (sourceStream: Readable, sourceName: string): Readable => {
    console.log(`[SoundService] Creating simple buffered stream for: ${sourceName}`);

    const bufferedStream = new PassThrough({
        highWaterMark: 256 * 1024, // 256KB buffer
        objectMode: false,
        allowHalfOpen: false, // Close when source closes
    });

    // Simple piping with monitoring - let Node.js handle the flow control
    let bytesTransferred = 0;

    sourceStream.on("data", chunk => {
        bytesTransferred += chunk.length;
        // Reduce logging frequency to avoid performance impact
        if (bytesTransferred % (64 * 1024) === 0 || chunk.length > 32 * 1024) {
            console.log(`[SoundService] Buffered stream transferred: ${bytesTransferred} bytes for ${sourceName}`);
        }
    });

    sourceStream.on("end", () => {
        console.log(`[SoundService] Buffered stream ended for: ${sourceName}, total bytes: ${bytesTransferred}`);
    });

    sourceStream.on("error", error => {
        console.error(`[SoundService] Buffered stream error for ${sourceName}:`, error);
        bufferedStream.destroy(error);
    });

    // Use native piping for optimal performance
    sourceStream.pipe(bufferedStream, { end: true });

    return bufferedStream;
};

export const readStreamToBytes = (stream: Readable): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });
        stream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        stream.on("error", err => {
            reject(err);
        });
    });
};
