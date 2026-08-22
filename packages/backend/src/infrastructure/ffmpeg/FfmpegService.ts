import ffmpeg from "fluent-ffmpeg";
import type { FfmpegCommand } from "fluent-ffmpeg";
import { PassThrough, Readable } from "stream";

// --- Resource limits -------------------------------------------------------

// Maximum number of ffmpeg child processes that may run at once. Each transcode
// is essentially one CPU-bound process, so N concurrent /play commands used to
// mean N ffmpeg processes with nothing bounding N. Requests beyond the limit
// queue instead of being spawned. 4 keeps a small VM/container responsive while
// still allowing a handful of simultaneous sounds.
const MAX_CONCURRENT_FFMPEG_PROCESSES = 4;

// A whole-buffer conversion is bounded work (a sound file, not a livestream);
// anything slower than this is a stuck process.
const CONVERT_TIMEOUT_MS = 5 * 60 * 1000;

// Streaming conversions run for the duration of the audio being played, so they
// get a much larger budget - it only exists to stop a wedged ffmpeg from
// holding a concurrency slot forever.
const STREAM_TIMEOUT_MS = 60 * 60 * 1000;

// How long a killed ffmpeg gets to exit after SIGTERM before it is SIGKILLed.
const KILL_GRACE_PERIOD_MS = 5 * 1000;

export type FfmpegConvertOptions = {
    readonly inputFormat?: string; // Input format (e.g., 'wav', 'mp3')
    readonly outputFormat: string; // Output format (e.g., 'wav', 'mp3')
    readonly sampleRate?: number; // Sample rate in Hz (e.g., 44100)
    readonly channels?: number; // Number of audio channels (e.g., 1 for mono, 2 for stereo)
    readonly codec: string; // Audio codec (e.g., 'libopus', 'aac')
    readonly bitrate?: string; // Bitrate (e.g., '128k', '256k')
    readonly extraArgs?: string[]; // Additional FFmpeg arguments
};

export type FfmpegService = {
    readonly convertAudio: (input: Uint8Array, options: FfmpegConvertOptions) => Promise<Uint8Array>;
    readonly convertStreamToStream: (inputStream: Readable, options: FfmpegConvertOptions) => Readable;
};

type Semaphore = {
    readonly acquire: () => Promise<void>;
    readonly release: () => void;
};

// Minimal FIFO counting semaphore - no dependency needed for ~20 lines.
const createSemaphore = (limit: number): Semaphore => {
    let active = 0;
    const waiting: (() => void)[] = [];

    return {
        acquire: () =>
            new Promise<void>(resolve => {
                if (active < limit) {
                    active++;
                    resolve();
                    return;
                }
                waiting.push(() => {
                    active++;
                    resolve();
                });
            }),
        release: () => {
            active = Math.max(0, active - 1);
            waiting.shift()?.();
        },
    };
};

// Kill a running ffmpeg process, escalating to SIGKILL if it ignores SIGTERM.
const killCommand = (cmd: FfmpegCommand): void => {
    cmd.kill("SIGTERM");
    const killTimer = setTimeout(() => cmd.kill("SIGKILL"), KILL_GRACE_PERIOD_MS);
    killTimer.unref();
};

export type FfmpegServiceOptions = {
    // Absolute path to the ffmpeg binary. When omitted, ffmpeg is resolved from PATH.
    readonly ffmpegPath?: string;
};

export const createFfmpegService = ({ ffmpegPath }: FfmpegServiceOptions = {}): FfmpegService => {
    // fluent-ffmpeg stores this module-globally, so it is set once at construction rather
    // than per command. Without it FFMPEG_PATH was accepted as config and silently ignored.
    if (ffmpegPath) {
        console.log(`[FfmpegService] Using ffmpeg binary at ${ffmpegPath}`);
        ffmpeg.setFfmpegPath(ffmpegPath);
    }

    const semaphore = createSemaphore(MAX_CONCURRENT_FFMPEG_PROCESSES);

    // Create a fluent-ffmpeg command.
    //
    // Note on flags: this pipeline decodes to raw PCM (-f s16le / pcm_s16le), so
    // the x264 options (-preset, -tune), the muxer options
    // (-avoid_negative_ts, -max_muxing_queue_size) that a raw stream has no
    // muxer for, and an output-side -fflags were all no-ops and have been
    // dropped. Only "+genpts+igndts" is kept, and as an *input* option where it
    // belongs: yt-dlp fragments frequently carry broken/absent DTS, and
    // regenerating timestamps at the demuxer avoids decode stalls.
    const createCommand = (inputStream: Readable, options?: { inputFormat?: string }): FfmpegCommand => {
        const cmd = ffmpeg(inputStream)
            .addInputOptions(["-fflags", "+genpts+igndts"])
            .on("error", (err, stdout, stderr) => {
                console.error("[FfmpegService] FFmpeg error:", err.message);
                if (stderr) {
                    console.error("[FfmpegService] FFmpeg stderr:", stderr);
                }
            });

        // Set input format if specified
        if (options?.inputFormat) {
            cmd.inputFormat(options.inputFormat);
        }

        return cmd;
    };

    // Apply conversion options to a fluent-ffmpeg command
    const applyConvertOptions = (cmd: FfmpegCommand, options: FfmpegConvertOptions): FfmpegCommand => {
        if (options.codec) {
            cmd.audioCodec(options.codec);
        }
        if (options.sampleRate) {
            cmd.audioFrequency(options.sampleRate);
        }
        if (options.channels) {
            cmd.audioChannels(options.channels);
        }
        if (options.bitrate) {
            cmd.audioBitrate(options.bitrate);
        }
        if (options.extraArgs && options.extraArgs.length > 0) {
            cmd.addOutputOptions(options.extraArgs);
        }
        if (options.outputFormat) {
            cmd.format(options.outputFormat);
        }

        return cmd;
    };

    // Convert audio buffer with specified options
    const convertAudio = async (input: Uint8Array, options: FfmpegConvertOptions): Promise<Uint8Array> => {
        const inputStream = Readable.from([input]);

        await semaphore.acquire();

        return new Promise<Uint8Array>((resolve, reject) => {
            const chunks: Uint8Array[] = [];

            let cmd = createCommand(inputStream, { inputFormat: options.inputFormat });
            cmd = applyConvertOptions(cmd, options);

            let settled = false;
            const settle = (error?: Error, result?: Uint8Array): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutTimer);
                semaphore.release();
                if (error) reject(error);
                else resolve(result as Uint8Array);
            };

            const timeoutTimer = setTimeout(() => {
                console.error(`[FfmpegService] Conversion timed out after ${CONVERT_TIMEOUT_MS}ms, killing ffmpeg`);
                killCommand(cmd);
                settle(new Error(`Audio conversion timed out after ${CONVERT_TIMEOUT_MS}ms`));
            }, CONVERT_TIMEOUT_MS);
            timeoutTimer.unref();

            cmd.on("error", err => {
                settle(new Error(`Audio conversion failed: ${err.message}`));
            })
                .on("end", () => {
                    settle(undefined, Buffer.concat(chunks));
                })
                .pipe()
                .on("data", (chunk: Uint8Array) => {
                    chunks.push(chunk);
                });
        });
    };

    // Convert audio stream to stream (most commonly used for real-time processing)
    //
    // The ffmpeg process is only spawned once a concurrency slot is free; the
    // output stream is returned immediately either way, so callers are unaware
    // of the queueing beyond the extra latency.
    const convertStreamToStream = (inputStream: Readable, options: FfmpegConvertOptions): Readable => {
        const outputStream = new PassThrough();

        void semaphore
            .acquire()
            .then(() => {
                // The consumer already gave up (e.g. /stop) while we were queued.
                if (outputStream.destroyed) {
                    semaphore.release();
                    return;
                }

                let cmd = createCommand(inputStream, { inputFormat: options.inputFormat });
                cmd = applyConvertOptions(cmd, options);

                console.log(`[FfmpegService] Converting stream: ${options.inputFormat || "auto"} -> ${options.outputFormat} ` + `(${options.sampleRate || "?"}Hz, ${options.channels || "?"}ch, codec: ${options.codec})`);

                let finished = false;
                const finish = (): void => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timeoutTimer);
                    semaphore.release();
                };

                const timeoutTimer = setTimeout(() => {
                    if (finished) return;
                    console.error(`[FfmpegService] Stream conversion timed out after ${STREAM_TIMEOUT_MS}ms, killing ffmpeg`);
                    killCommand(cmd);
                    outputStream.destroy(new Error(`Stream conversion timed out after ${STREAM_TIMEOUT_MS}ms`));
                }, STREAM_TIMEOUT_MS);
                timeoutTimer.unref();

                // Covers both normal completion and the consumer destroying the
                // output early: either way the slot is released and any still
                // running ffmpeg process is killed rather than orphaned.
                outputStream.on("close", () => {
                    const wasRunning = !finished;
                    finish();
                    if (wasRunning) killCommand(cmd);
                });

                cmd.on("error", err => {
                    console.error(`[FfmpegService] Stream conversion error: ${err.message}`);
                    finish();
                    outputStream.destroy(err);
                })
                    .on("end", () => {
                        console.log("[FfmpegService] Stream conversion completed");
                        finish();
                    })
                    .pipe(outputStream, { end: true });
            })
            .catch((error: Error) => {
                outputStream.destroy(error);
            });

        return outputStream;
    };

    return {
        convertAudio,
        convertStreamToStream,
    };
};
