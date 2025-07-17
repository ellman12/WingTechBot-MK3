import { type ChildProcess, spawn } from "child_process";
import { Readable } from "stream";

export type FfmpegConvertOptions = {
    inputFormat?: string; // Input format (e.g., 'wav', 'mp3')
    outputFormat: string; // Output format (e.g., 'wav', 'mp3')
    sampleRate?: number; // Sample rate in Hz (e.g., 44100)
    channels?: number; // Number of audio channels (e.g., 1 for mono, 2 for stereo)
    codec: string; // Audio codec (e.g., 'libopus', 'aac')
    bitrate?: string; // Bitrate (e.g., '128k', '256k')
};

export type FfmpegService = {
    // Raw ffmpeg process execution methods
    run: (inputStream: Readable, args: string[]) => ChildProcess;
    runStreamAsync: (inputStream: Readable, args: string[]) => Promise<Uint8Array>;
    runAsyncStream: (inputStream: Uint8Array, args: string[]) => Readable;
    runAsync: (inputStream: Uint8Array, args: string[]) => Promise<Uint8Array>;
    runAsyncWithStderr: (inputStream: Uint8Array, args: string[]) => Promise<{ stdout: Uint8Array; stderr: string }>;
    // Structured ffmpeg functions
    convertAudio: (input: Uint8Array, options: FfmpegConvertOptions) => Promise<Uint8Array>;
    convertStreamToAudio: (inputStream: Readable, options: FfmpegConvertOptions) => Promise<Uint8Array>;
    convertStreamToStream: (inputStream: Readable, options: FfmpegConvertOptions) => Readable;
    convertAudioToStream: (input: Uint8Array, options: FfmpegConvertOptions) => Readable;
    normalizeAudioStreamRealtime: (inputStream: Readable) => Readable;
    normalizeAudio: (input: Uint8Array, options: Partial<Pick<FfmpegConvertOptions, "channels" | "sampleRate">>) => Promise<Uint8Array>;
};

export const createFfmpegService = (): FfmpegService => {
    const run = (inputStream: Readable, args: string[]) => {
        const ffmpegInstance = spawn("ffmpeg", ["-i", "pipe:0", ...args, "-loglevel", "error", "pipe:1"]);
        if (!ffmpegInstance.pid) {
            throw new Error("Failed to start ffmpeg process");
        }
        inputStream.pipe(ffmpegInstance.stdin);

        ffmpegInstance.stdout.on("error", err => {
            console.error(`ffmpeg stdout error: ${err.message}`);
        });

        ffmpegInstance.stdout.on("close", () => {});

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
        if (options.inputFormat) {
            args.push("-f", options.inputFormat);
        }
        if (options.outputFormat) {
            args.push("-f", options.outputFormat);
        }
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
        console.log();

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
