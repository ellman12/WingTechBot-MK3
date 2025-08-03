import { type ChildProcess, spawn } from "child_process";
import { Readable } from "stream";

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
    const run = (inputStream: Readable, args: string[]) => {
        // Add aggressive real-time streaming optimizations
        const optimizedArgs = [
            "-i",
            "pipe:0",
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
            ...args,
            "-loglevel",
            "error",
            "pipe:1",
        ];

        const ffmpegInstance = spawn("ffmpeg", optimizedArgs, {
            stdio: ["pipe", "pipe", "pipe"],
        });

        if (!ffmpegInstance.pid) {
            throw new Error("Failed to start ffmpeg process");
        }

        // Optimize input piping
        inputStream.pipe(ffmpegInstance.stdin, { end: true });

        ffmpegInstance.stdout.on("error", err => {
            console.error(`ffmpeg stdout error: ${err.message}`);
        });

        ffmpegInstance.stderr.on("data", data => {
            const errorMsg = data.toString().trim();
            if (errorMsg && !errorMsg.includes("frame=") && !errorMsg.includes("size=")) {
                console.error(`ffmpeg stderr: ${errorMsg}`);
            }
        });

        ffmpegInstance.stdout.on("close", () => {
            console.log(`[FfmpegService] FFmpeg stdout closed`);
        });

        return ffmpegInstance;
    };
    const runStreamAsync = (inputStream: Readable, args: string[]) => {
        const ffmpegInstance = spawn("ffmpeg", ["-i", "pipe:0", ...args, "-loglevel", "error", "pipe:1"]);
        if (!ffmpegInstance.pid) {
            throw new Error("Failed to start ffmpeg process");
        }
        inputStream.pipe(ffmpegInstance.stdin);

        return new Promise<Uint8Array>((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            ffmpegInstance.stdout.on("data", (chunk: Uint8Array) => {
                chunks.push(chunk);
            });

            ffmpegInstance.stderr.on("data", (data: Uint8Array) => {
                console.error(`ffmpeg stderr: ${data.toString()}`);
            });

            ffmpegInstance.on("close", code => {
                if (code !== 0) {
                    reject(new Error(`ffmpeg process exited with code ${code}`));
                } else {
                    resolve(Buffer.concat(chunks));
                }
            });

            ffmpegInstance.on("error", err => {
                console.error(`ffmpeg process error: ${err.message}`);
                reject(err);
            });
        });
    };
    const runAsyncStream = (input: Uint8Array, args: string[]) => {
        const inputStream = Readable.from(input);
        const ffmpegInstance = spawn("ffmpeg", ["-i", "pipe:0", ...args, "-loglevel", "error", "pipe:1"]);
        if (!ffmpegInstance.pid) {
            throw new Error("Failed to start ffmpeg process");
        }
        inputStream.pipe(ffmpegInstance.stdin);

        return ffmpegInstance.stdout;
    };
    const runAsync = (input: Uint8Array, args: string[]) => {
        const ffmpegInstance = spawn("ffmpeg", ["-i", "pipe:0", ...args, "-loglevel", "error", "pipe:1"]);
        if (!ffmpegInstance.pid) {
            throw new Error("Failed to start ffmpeg process");
        }

        return new Promise<Uint8Array>((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            ffmpegInstance.stdin.write(input);
            ffmpegInstance.stdin.end();

            ffmpegInstance.stdout.on("data", (chunk: Uint8Array) => {
                chunks.push(chunk);
            });

            ffmpegInstance.stderr.on("data", (data: Uint8Array) => {
                console.error(`ffmpeg stderr: ${data.toString()}`);
            });

            ffmpegInstance.on("close", code => {
                if (code !== 0) {
                    reject(new Error(`ffmpeg process exited with code ${code}`));
                } else {
                    resolve(Buffer.concat(chunks));
                }
            });

            ffmpegInstance.on("error", err => {
                console.error(`ffmpeg process error: ${err.message}`);
                reject(err);
            });
        });
    };
    const runAsyncWithStderr = (input: Uint8Array, args: string[]) => {
        const ffmpegInstance = spawn("ffmpeg", ["-i", "pipe:0", ...args, "pipe:1"]);
        if (!ffmpegInstance.pid) {
            throw new Error("Failed to start ffmpeg process");
        }

        return new Promise<{ stdout: Uint8Array; stderr: string }>((resolve, reject) => {
            const stdoutChunks: Uint8Array[] = [];
            const stderrChunks: string[] = [];

            ffmpegInstance.stdin.write(input);
            ffmpegInstance.stdin.end();

            ffmpegInstance.stdout.on("data", (chunk: Uint8Array) => {
                stdoutChunks.push(chunk);
            });

            ffmpegInstance.stderr.on("data", (data: Uint8Array) => {
                stderrChunks.push(data.toString());
            });

            ffmpegInstance.on("close", code => {
                if (code !== 0) {
                    reject(new Error(`ffmpeg process exited with code ${code}`));
                } else {
                    resolve({
                        stdout: Buffer.concat(stdoutChunks),
                        stderr: stderrChunks.join(""),
                    });
                }
            });

            ffmpegInstance.on("error", err => {
                console.error(`ffmpeg process error: ${err.message}`);
                reject(err);
            });
        });
    };

    const createConvertArgs = (options: FfmpegConvertOptions): string[] => {
        if (!options.outputFormat) {
            throw new Error("Output format must be specified for audio conversion to stream");
        }

        if (!options.codec) {
            throw new Error("Codec must be specified for audio conversion to stream");
        }

        const args = [];
        // Only specify input format if explicitly provided, let FFmpeg auto-detect otherwise
        if (options.inputFormat) {
            args.push("-f", options.inputFormat);
        }
        // Only specify output format for the output, not input
        if (options.sampleRate) {
            args.push("-ar", options.sampleRate.toString());
        }
        if (options.channels) {
            args.push("-ac", options.channels.toString());
        }
        if (options.codec) {
            args.push("-c:a", options.codec);
        }
        if (options.bitrate) {
            args.push("-b:a", options.bitrate);
        }
        if (options.extraArgs) {
            args.push(...options.extraArgs);
        }
        // Add output format at the end
        args.push("-f", options.outputFormat);

        return args;
    };

    const convertAudio = async (input: Uint8Array, options: FfmpegConvertOptions) => {
        const args = createConvertArgs(options);
        return runAsync(input, args);
    };

    const convertStreamToAudio = async (inputStream: Readable, options: FfmpegConvertOptions) => {
        const args = createConvertArgs(options);

        return runStreamAsync(inputStream, args);
    };

    const convertStreamToStream = (inputStream: Readable, options: FfmpegConvertOptions) => {
        const args = createConvertArgs(options);

        console.log(`[FfmpegService] Converting stream with args:`, args);
        const ffmpegInstance = run(inputStream, args);

        return ffmpegInstance.stdout;
    };
    const convertAudioToStream = (input: Uint8Array, options: FfmpegConvertOptions) => {
        const args = createConvertArgs(options);

        return runAsyncStream(input, args);
    };

    /**
     * Normalizes audio in real-time using FFmpeg's loudnorm filter.
     * Returns a Readable stream that outputs the normalized audio in WAV format.
     */
    const normalizeAudioStreamRealtime = (inputStream: Readable) => {
        const args = ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11", "-f", "wav"];
        return run(inputStream, args).stdout;
    };

    /**
     * Normalizes audio using FFmpeg's loudnorm filter.
     * Returns a Promise that resolves to the normalized audio as a Uint8Array, in WAV format.
     */
    const normalizeAudio = async (input: Uint8Array, options: Pick<FfmpegConvertOptions, "channels" | "sampleRate">) => {
        console.log("Starting audio normalization process..");

        const preprocessArgs = ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null"];
        const preprocessResult = await runAsyncWithStderr(input, preprocessArgs);

        console.log(`FFmpeg preprocess stderr: ${preprocessResult.stderr}`);

        const jsonMatch = preprocessResult.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
        if (!jsonMatch) {
            throw new Error("Could not extract loudnorm parameters from FFmpeg output");
        }
        const normalizationParams = JSON.parse(jsonMatch[0]);

        console.log(`Normalization parameters: ${JSON.stringify(normalizationParams)}`);

        const args = [
            "-filter:a",
            `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${normalizationParams.input_i}:measured_LRA=${normalizationParams.input_lra}:measured_TP=${normalizationParams.input_tp}:measured_thresh=${normalizationParams.input_thresh}:offset=${normalizationParams.target_offset}:linear=true`,
            "-f",
            "wav",
            "-ar",
            options.sampleRate?.toString() || "48000",
            "-ac",
            options.channels?.toString() || "2",
        ];

        return runAsync(input, args);
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
