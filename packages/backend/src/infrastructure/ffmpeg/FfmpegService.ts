import type { ChildProcess } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import type { FfmpegCommand } from "fluent-ffmpeg";
import { PassThrough, Readable } from "stream";

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
    // Raw ffmpeg process execution methods
    readonly run: (inputStream: Readable, args: string[]) => ChildProcess;
    readonly runStreamAsync: (inputStream: Readable, args: string[]) => Promise<Uint8Array>;
    readonly runAsyncStream: (inputStream: Uint8Array, args: string[]) => Readable;
    readonly runAsync: (inputStream: Uint8Array, args: string[]) => Promise<Uint8Array>;
    readonly runAsyncWithStderr: (
        inputStream: Uint8Array,
        args: string[]
    ) => Promise<{
        stdout: Uint8Array;
        stderr: string;
    }>;
    // Structured ffmpeg functions
    readonly convertAudio: (input: Uint8Array, options: FfmpegConvertOptions) => Promise<Uint8Array>;
    readonly convertStreamToAudio: (inputStream: Readable, options: FfmpegConvertOptions) => Promise<Uint8Array>;
    readonly convertStreamToStream: (inputStream: Readable, options: FfmpegConvertOptions) => Readable;
    readonly convertAudioToStream: (input: Uint8Array, options: FfmpegConvertOptions) => Readable;
    readonly normalizeAudioStreamRealtime: (inputStream: Readable) => Readable;
    readonly normalizeAudio: (input: Uint8Array, options: Partial<Pick<FfmpegConvertOptions, "channels" | "sampleRate">>) => Promise<Uint8Array>;
};

export const createFfmpegService = (): FfmpegService => {
    // Create a fluent-ffmpeg command with optimized settings for real-time streaming
    const createCommand = (inputStream: Readable, options?: { inputFormat?: string }): FfmpegCommand => {
        const cmd = ffmpeg(inputStream)
            // Real-time streaming optimizations
            .addOutputOptions([
                "-fflags",
                "+genpts+igndts", // Generate timestamps and ignore input timestamps
                "-avoid_negative_ts",
                "make_zero", // Avoid timing issues
                "-max_muxing_queue_size",
                "1024", // Larger muxing queue for streaming
                "-preset",
                "ultrafast", // Fastest encoding preset
                "-tune",
                "zerolatency", // Optimize for real-time streaming
            ])
            .on("error", (err, stdout, stderr) => {
                console.error("[FfmpegService] FFmpeg error:", err.message);
                if (stderr) {
                    console.error("[FfmpegService] FFmpeg stderr:", stderr);
                }
            })
            .on("stderr", stderrLine => {
                // Only log actual errors, not progress info
                if (stderrLine && !stderrLine.includes("frame=") && !stderrLine.includes("size=")) {
                    console.error("[FfmpegService] FFmpeg:", stderrLine);
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

    // Legacy raw execution method for backward compatibility
    // Kept for cases that need direct process access
    const run = (inputStream: Readable, args: string[]): ChildProcess => {
        const outputStream = new PassThrough();
        const cmd = ffmpeg(inputStream)
            .addOutputOptions(args)
            .format("pipe")
            .on("error", err => {
                console.error("[FfmpegService] Process error:", err.message);
            });

        // Return the underlying process for compatibility
        const process = cmd.pipe(outputStream, { end: true }) as unknown as ChildProcess;
        return process;
    };

    // Convert stream input to buffer output
    const runStreamAsync = async (inputStream: Readable, args: string[]): Promise<Uint8Array> => {
        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];

            ffmpeg(inputStream)
                .addOutputOptions(args)
                .format("pipe")
                .on("error", err => {
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .on("end", () => {
                    resolve(Buffer.concat(chunks));
                })
                .pipe()
                .on("data", (chunk: Uint8Array) => {
                    chunks.push(chunk);
                });
        });
    };

    // Convert buffer input to stream output
    const runAsyncStream = (input: Uint8Array, args: string[]): Readable => {
        const inputStream = Readable.from([input]);
        const outputStream = new PassThrough();

        ffmpeg(inputStream)
            .addOutputOptions(args)
            .format("pipe")
            .on("error", err => {
                outputStream.destroy(err);
            })
            .pipe(outputStream, { end: true });

        return outputStream;
    };

    // Convert buffer input to buffer output
    const runAsync = async (input: Uint8Array, args: string[]): Promise<Uint8Array> => {
        const inputStream = Readable.from([input]);
        return runStreamAsync(inputStream, args);
    };

    // Run FFmpeg with stderr capture
    const runAsyncWithStderr = async (input: Uint8Array, args: string[]): Promise<{ stdout: Uint8Array; stderr: string }> => {
        const inputStream = Readable.from([input]);

        return new Promise((resolve, reject) => {
            const stdoutChunks: Uint8Array[] = [];
            const stderrChunks: string[] = [];

            ffmpeg(inputStream)
                .addOutputOptions(args)
                .format("pipe")
                .on("error", err => {
                    reject(new Error(`FFmpeg error: ${err.message}. stderr: ${stderrChunks.join("")}`));
                })
                .on("stderr", line => {
                    stderrChunks.push(line + "\n");
                })
                .on("end", () => {
                    resolve({
                        stdout: Buffer.concat(stdoutChunks),
                        stderr: stderrChunks.join(""),
                    });
                })
                .pipe()
                .on("data", (chunk: Uint8Array) => {
                    stdoutChunks.push(chunk);
                });
        });
    };

    // Convert audio buffer with specified options
    const convertAudio = async (input: Uint8Array, options: FfmpegConvertOptions): Promise<Uint8Array> => {
        const inputStream = Readable.from([input]);

        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];

            let cmd = createCommand(inputStream, { inputFormat: options.inputFormat });
            cmd = applyConvertOptions(cmd, options);

            cmd.on("error", err => {
                reject(new Error(`Audio conversion failed: ${err.message}`));
            })
                .on("end", () => {
                    resolve(Buffer.concat(chunks));
                })
                .pipe()
                .on("data", (chunk: Uint8Array) => {
                    chunks.push(chunk);
                });
        });
    };

    // Convert audio stream to buffer
    const convertStreamToAudio = async (inputStream: Readable, options: FfmpegConvertOptions): Promise<Uint8Array> => {
        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];

            let cmd = createCommand(inputStream, { inputFormat: options.inputFormat });
            cmd = applyConvertOptions(cmd, options);

            cmd.on("error", err => {
                reject(new Error(`Stream conversion failed: ${err.message}`));
            })
                .on("end", () => {
                    resolve(Buffer.concat(chunks));
                })
                .pipe()
                .on("data", (chunk: Uint8Array) => {
                    chunks.push(chunk);
                });
        });
    };

    // Convert audio stream to stream (most commonly used for real-time processing)
    const convertStreamToStream = (inputStream: Readable, options: FfmpegConvertOptions): Readable => {
        const outputStream = new PassThrough();

        let cmd = createCommand(inputStream, { inputFormat: options.inputFormat });
        cmd = applyConvertOptions(cmd, options);

        console.log(`[FfmpegService] Converting stream: ${options.inputFormat || "auto"} -> ${options.outputFormat} ` + `(${options.sampleRate || "?"}Hz, ${options.channels || "?"}ch, codec: ${options.codec})`);

        cmd.on("error", err => {
            console.error(`[FfmpegService] Stream conversion error: ${err.message}`);
            outputStream.destroy(err);
        })
            .on("end", () => {
                console.log("[FfmpegService] Stream conversion completed");
            })
            .pipe(outputStream, { end: true });

        return outputStream;
    };

    // Convert audio buffer to stream
    const convertAudioToStream = (input: Uint8Array, options: FfmpegConvertOptions): Readable => {
        const inputStream = Readable.from([input]);
        return convertStreamToStream(inputStream, options);
    };

    // Normalize audio stream in real-time using loudnorm filter
    const normalizeAudioStreamRealtime = (inputStream: Readable): Readable => {
        const outputStream = new PassThrough();

        ffmpeg(inputStream)
            .audioFilters("loudnorm=I=-16:TP=-1.5:LRA=11:linear=true")
            .format("wav")
            .on("error", err => {
                console.error(`[FfmpegService] Normalization error: ${err.message}`);
                outputStream.destroy(err);
            })
            .pipe(outputStream, { end: true });

        return outputStream;
    };

    // Two-pass audio normalization with measurement for better quality
    const normalizeAudio = async (input: Uint8Array, options: Partial<Pick<FfmpegConvertOptions, "channels" | "sampleRate">>): Promise<Uint8Array> => {
        console.log("[FfmpegService] Starting two-pass audio normalization");

        // First pass: measure audio characteristics
        const measureResult = await runAsyncWithStderr(input, ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null"]);

        console.log(`[FfmpegService] Measurement complete`);

        // Extract normalization parameters from JSON output
        const jsonMatch = measureResult.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
        if (!jsonMatch) {
            throw new Error("Could not extract loudnorm parameters from FFmpeg output");
        }

        const normalizationParams = JSON.parse(jsonMatch[0]);
        console.log(`[FfmpegService] Normalization parameters:`, normalizationParams);

        // Second pass: apply normalization with measured parameters
        const inputStream = Readable.from([input]);
        const sampleRate = options.sampleRate || 48000;
        const channels = options.channels || 2;

        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];

            ffmpeg(inputStream)
                .audioFilters(
                    `loudnorm=I=-14:TP=-1.5:LRA=11:` +
                        `measured_I=${normalizationParams.input_i}:` +
                        `measured_LRA=${normalizationParams.input_lra}:` +
                        `measured_TP=${normalizationParams.input_tp}:` +
                        `measured_thresh=${normalizationParams.input_thresh}:` +
                        `offset=${normalizationParams.target_offset}:` +
                        `linear=true`
                )
                .format("wav")
                .audioFrequency(sampleRate)
                .audioChannels(channels)
                .on("error", err => {
                    reject(new Error(`Normalization failed: ${err.message}`));
                })
                .on("end", () => {
                    console.log("[FfmpegService] Normalization complete");
                    resolve(Buffer.concat(chunks));
                })
                .pipe()
                .on("data", (chunk: Uint8Array) => {
                    chunks.push(chunk);
                });
        });
    };

    return {
        run,
        runStreamAsync,
        runAsyncStream,
        runAsync,
        runAsyncWithStderr,
        convertAudio,
        convertStreamToAudio,
        convertStreamToStream,
        convertAudioToStream,
        normalizeAudioStreamRealtime,
        normalizeAudio,
    };
};
